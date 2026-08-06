const { buildExplorationResult, hasCompleteAnswers } = require('../../utils/exploration')
const { getExploration, markExplorationSaved, recordEvent } = require('../../utils/storage')
const { saveExplorationToCloud, cloudErrorMessage } = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  data: {
    result: null,
    isReady: false,
    isSaved: false,
    isSaving: false,
    cloudError: ''
  },

  onLoad() {
    const exploration = getExploration()
    const result = exploration.result || (
      hasCompleteAnswers(exploration.answers)
        ? buildExplorationResult(exploration.answers)
        : null
    )
    this.setData({
      result,
      isReady: Boolean(result),
      isSaved: exploration.status === 'saved'
    })
  },

  onShow() {
    resetNavigation(this)
    if (this.data.isReady) recordEvent('exploration_result_view')
  },

  handleSave() {
    if (!this.data.isReady || this._isRouting || this.data.isSaving) return
    if (this.data.isSaved) {
      this.continueAfterSave()
      return
    }
    const exploration = markExplorationSaved()
    recordEvent('exploration_save_click')
    this.setData({ isSaving: true, cloudError: '' })
    saveExplorationToCloud(exploration, {
      success: () => {
        this.setData({ isSaving: false })
        this.continueAfterSave()
      },
      fail: error => {
        const message = cloudErrorMessage(error)
        this.setData({ isSaving: false, cloudError: `${message}，请重试保存` })
        wx.showToast({ title: message, icon: 'none' })
      }
    })
  },

  continueAfterSave() {
    navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
  },

  handleLeave() {
    if (this._isRouting) return
    recordEvent('exploration_leave')
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  restartExploration() {
    if (this._isRouting || this.data.isSaved) return
    navigateOnce(this, 'redirectTo', { url: '/pages/exploration/index?question=0&direction=back' })
  }
})
