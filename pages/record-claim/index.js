const {
  getRelationshipRecord,
  getRecordFeedback,
  replaceRecordFeedback,
  saveClaimFeedback,
  recordEvent
} = require('../../utils/storage')
const { saveRecordFeedbackToCloud, cloudErrorMessage } = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  data: {
    claim: null,
    selectedFeedback: '',
    feedbackOptions: [
      { value: 'fits', label: '比较符合我' },
      { value: 'unsure', label: '我还不确定' },
      { value: 'not_fits', label: '不太符合我' }
    ],
    canSave: false,
    isSaving: false,
    cloudError: ''
  },

  onLoad(query) {
    this.claimId = decodeURIComponent(query.id || '')
  },

  onShow() {
    resetNavigation(this)
    const claim = getRelationshipRecord().claims.find(item => item.id === this.claimId)
    if (!claim) {
      navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
      return
    }
    const selectedFeedback = claim.feedback === 'unreviewed' ? '' : claim.feedback
    this.setData({ claim, selectedFeedback, canSave: false, cloudError: '' })
    recordEvent('record_claim_view', { claimId: claim.id })
  },

  chooseFeedback(event) {
    const value = event.currentTarget.dataset.value
    this.setData({
      selectedFeedback: value,
      canSave: value !== this.data.claim.feedback,
      cloudError: ''
    })
  },

  handleSave() {
    if (!this.data.canSave || this.data.isSaving || this._isRouting) return
    const previous = getRecordFeedback()
    const next = saveClaimFeedback(this.claimId, this.data.selectedFeedback)
    this.setData({ isSaving: true, cloudError: '' })
    saveRecordFeedbackToCloud(next, {
      success: () => {
        this.setData({ isSaving: false })
        recordEvent('record_claim_feedback', {
          claimId: this.claimId,
          value: this.data.selectedFeedback
        })
        wx.showToast({ title: '已更新这条判断', icon: 'success' })
        navigateOnce(this, 'navigateBack', {
          fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
        })
      },
      fail: error => {
        replaceRecordFeedback(previous)
        const message = cloudErrorMessage(error)
        this.setData({
          isSaving: false,
          cloudError: `${message}，你的原有反馈没有改变`
        })
        wx.showToast({ title: message, icon: 'none' })
      }
    })
  }
})
