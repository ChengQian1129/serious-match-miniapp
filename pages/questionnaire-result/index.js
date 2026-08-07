const { getReport, getSession, shouldSyncAssessment, markFeedbackEventSynced, replaceSession, replaceReport, resetAssessment } = require('../../utils/assessment-v2/session-store')
const { isCloudReady, completeAssessmentToCloud, appendAssessmentFeedbackToCloud, deleteCloudAssessment, cloudErrorMessage } = require('../../utils/cloud')
const { clearAssessmentFromProfile, recordEvent } = require('../../utils/storage')
const { CHAPTERS } = require('../../utils/assessment-v2/questionnaire-definitions')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { FEATURES } = require('../../utils/features')

Page({
  data: { statusBarHeight: getStatusBarHeight(), report: null, sections: [], unknowns: [], shareFragments: [], chapters: CHAPTERS, showFollowup: FEATURES.followupParticipation, showDeleteDialog: false, isDeleting: false, deleteConfirmButton: { content: '删除', theme: 'danger', variant: 'base' } },
  onLoad() {
    this.loadReport()
  },
  loadReport() {
    const report = getReport()
    if (!report) return
    const groups = [
      { id: 'overall', title: '你现在处于什么阶段' },
      { id: 'interaction', title: '你怎样靠近一个人' },
      { id: 'resource', title: '什么让关系变得稳定' },
      { id: 'provide', title: '你通常能提供什么' },
      { id: 'tension', title: '你的回答里有哪些拉扯' },
      { id: 'observation', title: '认识新的人时值得观察什么' }
    ]
    const confirmations = report.userConfirmations || {}
    const confirmationLabels = { fits: '本人确认符合', partly_fits: '本人确认部分符合', does_not_fit: '本人认为不符合', unsure: '本人暂不确定' }
    const decoratedClaims = report.claims.map((claim, index) => {
      const confirmation = confirmations[claim.id]
      return Object.assign({}, claim, { originalIndex: index, confirmationLabel: confirmation ? confirmationLabels[confirmation.value] : '' })
    })
    const orderedClaims = decoratedClaims.sort((left, right) => Number(Boolean(right.confirmationLabel)) - Number(Boolean(left.confirmationLabel)) || Number(right.confidence && right.confidence.level === 'strong') - Number(left.confidence && left.confidence.level === 'strong') || left.originalIndex - right.originalIndex)
    const shareFragments = report.claims.filter(claim => claim.shareFragment && confirmations[claim.id] && ['fits', 'partly_fits'].includes(confirmations[claim.id].value)).map(claim => claim.shareFragment).slice(0, 2)
    this.setData({ report, sections: groups.map(group => Object.assign({}, group, { claims: orderedClaims.filter(claim => claim.section === group.id) })).filter(group => group.claims.length), unknowns: report.unknowns, shareFragments, shareableCount: shareFragments.length })
    recordEvent('assessment_v2_report_view')
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
    navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire/index?chapter=C1&question=0' })
  },
  reviseChapter(event) { navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire/index?chapter=${event.currentTarget.dataset.chapter}&question=0&revise=1` }) },
  openClaim(event) { navigateOnce(this, 'navigateTo', { url: `/pages/record-claim/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }) },
  openShare() { navigateOnce(this, 'navigateTo', { url: '/pages/share-card/index' }) },
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
  openMap() { navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' }) },
  openFollowup() { navigateOnce(this, 'navigateTo', { url: '/pages/followup-intro/index' }) }
})
