const { getReport, getSession, shouldSyncAssessment, markFeedbackEventSynced, replaceSession, replaceReport, resetAssessment } = require('../../utils/assessment-v2/session-store')
const { isCloudReady, completeAssessmentToCloud, appendAssessmentFeedbackToCloud, deleteCloudAssessment, cloudErrorMessage } = require('../../utils/cloud')
const { clearAssessmentFromProfile, recordEvent } = require('../../utils/storage')
const { CHAPTERS } = require('../../utils/assessment-v2/questionnaire-definitions')
const { buildChapterInsight } = require('../../utils/assessment-v2/chapter-insight-engine')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { FEATURES } = require('../../utils/features')
const reportCopy = require('../../shared/content/report-copy')
const { sections: reportSections, CONTENT_VERSION } = reportCopy
const { recordEvent: recordContentEvent } = require('../../utils/storage')

const SECTION_ORDER = Object.freeze({ overall: 0, interaction: 1, resource: 2, provide: 3, tension: 4, observation: 5 })

function orderedClaims(claims) {
  return (claims || []).map((claim, index) => Object.assign({}, claim, { originalIndex: index }))
    .sort((left, right) => (SECTION_ORDER[left.section] === undefined ? 99 : SECTION_ORDER[left.section]) - (SECTION_ORDER[right.section] === undefined ? 99 : SECTION_ORDER[right.section]) || left.originalIndex - right.originalIndex)
}

function coveredObservationIds(claims) {
  return new Set(claims.filter(claim => claim.section !== 'observation').flatMap(claim => [].concat(claim.supportingItemIds || [], claim.contradictingItemIds || [], claim.qualifyingItemIds || [])))
}

function chapterResults(answers, report) {
  return CHAPTERS.map((chapter, index) => {
    const insight = buildChapterInsight(chapter.id, answers || {}, { report })
    return {
      id: chapter.id,
      number: String(index + 1).padStart(2, '0'),
      title: chapter.title,
      headline: insight.headline || insight.title,
      summary: insight.summary || [insight.text, insight.impact].filter(Boolean).join('\n\n')
    }
  })
}

function topFindings(claims, chapters) {
  const selected = []
  const seen = new Set()
  for (const claim of claims) {
    const key = claim.id || claim.title
    if (!key || seen.has(key)) continue
    selected.push({ title: claim.title, text: claim.text, claimId: claim.id || '' })
    seen.add(key)
    if (selected.length === 3) break
  }
  if (selected.length < 3) {
    chapters.forEach(chapter => {
      if (selected.length >= 3) return
      if (selected.some(item => item.title === chapter.headline)) return
      selected.push({ title: chapter.headline, text: chapter.summary, claimId: '' })
    })
  }
  return selected.map((item, index) => Object.assign({ number: String(index + 1).padStart(2, '0') }, item))
}

function detailSections(claims) {
  const observationIds = coveredObservationIds(claims)
  const observations = claims.filter(claim => claim.section === 'observation' && ![].concat(claim.supportingItemIds || [], claim.contradictingItemIds || [], claim.qualifyingItemIds || []).some(id => observationIds.has(id))).slice(0, 2)
  const sections = reportSections.map(group => Object.assign({}, group, {
    claims: claims.filter(claim => claim.section === group.id)
  })).filter(group => group.claims.length)
  return { sections, observations }
}

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    contentVersion: CONTENT_VERSION,
    report: null,
    topFindings: [],
    chapterResults: [],
    sections: [],
    observations: [],
    unknowns: [],
    chapters: CHAPTERS.map((chapter, index) => Object.assign({}, chapter, { number: String(index + 1).padStart(2, '0') })),
    showDetails: false,
    showFollowup: FEATURES.followupParticipation,
    showDeleteDialog: false,
    isDeleting: false,
    deleteConfirmButton: { content: '删除', theme: 'danger', variant: 'base' }
  },

  onLoad() { this.loadReport() },

  loadReport() {
    const report = getReport()
    if (!report) return
    const claims = orderedClaims(report.claims)
    const chapters = chapterResults((getSession() && getSession().answers) || {}, report)
    const details = detailSections(claims)
    this.setData({
      report,
      topFindings: topFindings(claims, chapters),
      chapterResults: chapters,
      sections: details.sections,
      observations: details.observations,
      unknowns: report.unknowns || [],
      unknownTitle: reportCopy.unknownTitle,
      unknownDescription: reportCopy.unknownDescription,
      observationTitle: reportCopy.observationTitle,
      heroIntro: reportCopy.heroIntro,
      topFindingsTitle: reportCopy.topFindingsTitle,
      chapterResultsTitle: reportCopy.chapterResultsTitle,
      chapterResultsDescription: reportCopy.chapterResultsDescription,
      detailsTitle: reportCopy.detailsTitle,
      detailsDescription: reportCopy.detailsDescription,
      detailsAction: reportCopy.detailsAction,
      detailsCollapseAction: reportCopy.detailsCollapseAction,
      boundaryCopy: reportCopy.boundary,
      reviseTitle: reportCopy.reviseTitle,
      dataTitle: reportCopy.dataTitle,
      dataDelete: reportCopy.dataDelete,
      deleteDialogTitle: reportCopy.deleteDialogTitle,
      deleteDialogContent: reportCopy.deleteDialogContent,
      deleteDialogCancel: reportCopy.deleteDialogCancel,
      mapAction: reportCopy.mapAction,
      followupTitle: reportCopy.followupTitle,
      followupBody: reportCopy.followupBody,
      followupAction: reportCopy.followupAction,
      claimAction: reportCopy.claimAction
    })
    recordContentEvent('report_view')
  },

  onShow() { resetNavigation(this); this.loadReport(); this.syncReportIfNeeded(); this.syncPendingConfirmations() },

  toggleDetails() {
    const expanded = !this.data.showDetails
    this.setData({ showDetails: expanded })
    recordContentEvent('report_details_toggle', { expanded })
  },

  syncReportIfNeeded() {
    if (this._reportSyncing || !shouldSyncAssessment() || !isCloudReady()) return
    const report = getReport()
    if (!report || report._id) return
    this._reportSyncing = true
    completeAssessmentToCloud(getSession(), {
      success: data => {
        if (data.session) replaceSession(data.session)
        if (data.report) replaceReport(data.report)
        this._reportSyncing = false
        this.loadReport()
        this.syncPendingConfirmations()
      },
      fail: () => {
        this._reportSyncing = false
        recordEvent('assessment_v2_report_sync_failed')
      }
    })
  },

  // Keep the historical confirmation queue uploadable without exposing it in the new UI.
  syncPendingConfirmations() {
    if (this._confirmationSyncing) return
    const report = getReport()
    if (!report || !report._id || !shouldSyncAssessment() || !isCloudReady()) return
    const queue = (report.feedbackEvents || []).filter(event => event.pendingCloud)
    if (!queue.length) return
    this._confirmationSyncing = true
    const syncNext = () => {
      const next = queue.shift()
      if (!next) { this._confirmationSyncing = false; return }
      appendAssessmentFeedbackToCloud(report._id, next, {
        success: data => { markFeedbackEventSynced(next.eventId, data.feedbackEvent); syncNext() },
        fail: syncNext
      })
    }
    syncNext()
  },

  revise() {
    recordContentEvent('report_revise')
    navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire/index?chapter=C1&question=0' })
  },

  reviseChapter(event) {
    recordContentEvent('report_revise', { chapterId: event.currentTarget.dataset.chapter })
    navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire/index?chapter=${event.currentTarget.dataset.chapter}&question=0&revise=1` })
  },

  openClaim(event) {
    const claimId = event.currentTarget.dataset.id
    if (!claimId) return
    recordContentEvent('report_claim_open', { claimId })
    navigateOnce(this, 'navigateTo', { url: `/pages/record-claim/index?id=${encodeURIComponent(claimId)}` })
  },

  requestDeleteReport() { this.setData({ showDeleteDialog: true }) },
  cancelDeleteReport() { this.setData({ showDeleteDialog: false }) },

  confirmDeleteReport() {
    if (this.data.isDeleting) return
    this.setData({ showDeleteDialog: false, isDeleting: true })
    const finish = () => {
      resetAssessment()
      clearAssessmentFromProfile()
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index', fail: () => this.setData({ isDeleting: false }) })
    }
    if (!isCloudReady()) return finish()
    deleteCloudAssessment({
      success: finish,
      fail: error => {
        this.setData({ isDeleting: false })
        wx.showToast({ title: cloudErrorMessage(error), icon: 'none' })
      }
    })
  },

  openMap() { navigateOnce(this, 'navigateTo', { url: '/pages/relationship-map/index' }) },
  openFollowup() { recordContentEvent('followup_entry_view'); navigateOnce(this, 'navigateTo', { url: '/pages/followup-intro/index?returnTo=report' }) }
})

module.exports = { orderedClaims, chapterResults, topFindings, detailSections }
