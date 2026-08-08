const { getReport, getSession, shouldSyncAssessment, markFeedbackEventSynced, replaceSession, replaceReport, resetAssessment } = require('../../utils/assessment-v2/session-store')
const { isCloudReady, completeAssessmentToCloud, appendAssessmentFeedbackToCloud, deleteCloudAssessment, cloudErrorMessage } = require('../../utils/cloud')
const { clearAssessmentFromProfile, recordEvent } = require('../../utils/storage')
const { CHAPTERS } = require('../../utils/assessment-v2/questionnaire-definitions')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { FEATURES } = require('../../utils/features')
const reportCopy = require('../../shared/content/report-copy')
const { sections: reportSections, confirmationLabels, CONTENT_VERSION } = reportCopy
const { recordEvent: recordContentEvent } = require('../../utils/storage')

function coveredObservationIds(claims) {
  return new Set(claims.filter(claim => claim.section !== 'observation').flatMap(claim => [].concat(claim.supportingItemIds || [], claim.contradictingItemIds || [], claim.qualifyingItemIds || [])))
}

Page({
  data: { statusBarHeight: getStatusBarHeight(), contentVersion: CONTENT_VERSION, report: null, heroClaim: null, heroIntro: reportCopy.heroIntro, sections: [], observations: [], unknowns: [], chapters: CHAPTERS, showFollowup: FEATURES.followupParticipation, showDeleteDialog: false, isDeleting: false, deleteConfirmButton: { content: '删除', theme: 'danger', variant: 'base' } },
  onLoad() {
    this.loadReport()
  },
  loadReport() {
    const report = getReport()
    if (!report) return
    const confirmations = report.userConfirmations || {}
    const decoratedClaims = report.claims.map((claim, index) => {
      const confirmation = confirmations[claim.id]
      return Object.assign({}, claim, { originalIndex: index, confirmationLabel: confirmation ? confirmationLabels[confirmation.value] : '' })
    })
    const orderedClaims = decoratedClaims.sort((left, right) => Number(Boolean(right.confirmationLabel)) - Number(Boolean(left.confirmationLabel)) || Number(right.confidence && right.confidence.level === 'strong') - Number(left.confidence && left.confidence.level === 'strong') || left.originalIndex - right.originalIndex)
    const heroClaim = orderedClaims.find(claim => claim.section === 'overall') || orderedClaims[0] || null
    const observationIds = coveredObservationIds(orderedClaims)
    const observations = orderedClaims.filter(claim => claim.section === 'observation' && ![].concat(claim.supportingItemIds || [], claim.contradictingItemIds || [], claim.qualifyingItemIds || []).some(id => observationIds.has(id))).slice(0, 2)
    const sections = reportSections.map(group => Object.assign({}, group, {
      claims: orderedClaims.filter(claim => claim.section === group.id && (!heroClaim || claim.id !== heroClaim.id))
    })).filter(group => group.claims.length)
    this.setData({ report, heroClaim, sections, observations, unknowns: report.unknowns, unknownTitle: reportCopy.unknownTitle, unknownDescription: reportCopy.unknownDescription, observationTitle: reportCopy.observationTitle, boundaryCopy: reportCopy.boundary, reviseTitle: reportCopy.reviseTitle, dataTitle: reportCopy.dataTitle, dataDelete: reportCopy.dataDelete, deleteDialogTitle: reportCopy.deleteDialogTitle, deleteDialogContent: reportCopy.deleteDialogContent, deleteDialogCancel: reportCopy.deleteDialogCancel, mapAction: reportCopy.mapAction, followupTitle: reportCopy.followupTitle, followupBody: reportCopy.followupBody, followupAction: reportCopy.followupAction, claimAction: reportCopy.claimAction })
    recordContentEvent('report_view')
  },
  onShow() { resetNavigation(this); this.loadReport(); this.syncReportIfNeeded(); this.syncPendingConfirmations() },
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
    recordContentEvent('report_claim_open', { claimId: event.currentTarget.dataset.id })
    navigateOnce(this, 'navigateTo', { url: `/pages/record-claim/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` })
  },
  requestDeleteReport() { this.setData({ showDeleteDialog: true }) },
  cancelDeleteReport() { this.setData({ showDeleteDialog: false }) },
  confirmDeleteReport() {
    if (this.data.isDeleting) return
    this.setData({ showDeleteDialog: false, isDeleting: true })
    const finish = () => {
      resetAssessment()
      clearAssessmentFromProfile()
      navigateOnce(this, 'reLaunch', {
        url: '/pages/home/index',
        fail: () => this.setData({ isDeleting: false })
      })
    }
    if (!isCloudReady()) {
      finish()
      return
    }
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
