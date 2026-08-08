const { getReport, shouldSyncAssessment, saveClaimFeedback, markFeedbackEventSynced } = require('../../utils/assessment-v2/session-store')
const { isCloudReady, appendAssessmentFeedbackToCloud } = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  data: { claim: null, selectedFeedback: '', feedbackNote: '', feedbackContext: '', feedbackOptions: [{ value: 'fits', label: '比较符合我' }, { value: 'partly_fits', label: '部分符合我' }, { value: 'does_not_fit', label: '不太符合我' }, { value: 'unsure', label: '我还不确定' }], canSave: false, isSaving: false, cloudError: '' },
  onLoad(query) { this.claimId = decodeURIComponent(query.id || '') },
  onShow() {
    resetNavigation(this)
    const report = getReport()
    const claim = report && report.claims.find(item => item.id === this.claimId)
    if (!claim) return navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' })
    const confirmation = report.userConfirmations && report.userConfirmations[this.claimId]
    const decoratedClaim = Object.assign({}, claim, { label: '这句话为什么出现', statusLabel: '' })
    this.setData({ claim: decoratedClaim, selectedFeedback: confirmation ? confirmation.value : '', feedbackNote: confirmation ? confirmation.note || '' : '', feedbackContext: confirmation ? confirmation.context || '' : '', canSave: false, isSaving: false, cloudError: '' })
  },
  chooseFeedback(event) { this.setData({ selectedFeedback: event.currentTarget.dataset.value, canSave: true }) },
  inputNote(event) { this.setData({ feedbackNote: String(event.detail.value || '').slice(0, 200), canSave: Boolean(this.data.selectedFeedback) }) },
  inputContext(event) { this.setData({ feedbackContext: String(event.detail.value || '').slice(0, 200), canSave: Boolean(this.data.selectedFeedback) }) },
  handleSave() {
    if (!this.data.canSave || this.data.isSaving) return
    this.setData({ isSaving: true, cloudError: '' })
    const feedbackEvent = saveClaimFeedback(this.claimId, this.data.selectedFeedback, this.data.feedbackNote, '')
    const report = getReport()
    const finish = () => {
      this.setData({ isSaving: false })
      wx.showToast({ title: '已记录你的核对', icon: 'success' })
      navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' }) })
    }
    if (shouldSyncAssessment() && isCloudReady() && report && report._id) {
      return appendAssessmentFeedbackToCloud(report._id, feedbackEvent, { success: data => { markFeedbackEventSynced(feedbackEvent.eventId, data.feedbackEvent); finish() }, fail: () => this.setData({ isSaving: false, cloudError: '云端暂时没有记住这次核对，请保持网络后重试。' }) })
    }
    finish()
  }
})
