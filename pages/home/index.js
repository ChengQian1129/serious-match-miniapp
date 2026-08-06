const {
  getProfile,
  hasProfile,
  getExploration,
  hasExploration,
  replaceExploration,
  getRecordFeedback,
  replaceRecordFeedback,
  getQuestionnaireData,
  replaceQuestionnaireData,
  replaceProfile,
  markCloudSynced,
  needsCloudSync,
  recordEvent
} = require('../../utils/storage')
const { isCloudReady, getProfileFromCloud } = require('../../utils/cloud')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    showGuide: false,
    hasSavedProfile: false,
    actionText: '开始了解自己',
    heroTitle: '从五个相处选择开始',
    heroDesc: '用大约 1 分钟，先看看联系、回应、支持和冲突处理偏好。',
    isRestoring: false,
    cloudReady: isCloudReady()
  },

  onShow() {
    resetNavigation(this)
    this.refreshLocalState()
    this.restoreCloudProfile()
    recordEvent('home_view')
  },

  refreshLocalState() {
    const exists = hasProfile()
    const profile = getProfile()
    const hasCompletedProfile = exists && (profile.status === 'active' || profile.status === 'paused')
    const explorationExists = hasExploration()
    const exploration = getExploration()
    let actionText = '开始了解自己'
    let heroTitle = '从五个相处选择开始'
    let heroDesc = '用大约 1 分钟，先看看联系、回应、支持和冲突处理偏好。'

    if (hasCompletedProfile) {
      actionText = '查看我的关系底图'
      heroTitle = '你的关系底图在这里'
      heroDesc = '明确资料、初步判断和仍待了解的部分，都可以回来继续核对和维护。'
    } else if (exists) {
      actionText = '继续整理我的关系底图'
      heroTitle = '你的关系底图正在形成'
      heroDesc = '之前填写的内容仍保存在当前设备，可以从底图里继续补充。'
    } else if (explorationExists && exploration.status === 'saved') {
      actionText = '继续整理我的关系底图'
      heroTitle = '第一组初步判断已经保存'
      heroDesc = '现在可以查看依据、核对判断，或者继续补充个人档案。'
    } else if (explorationExists && exploration.status === 'complete') {
      actionText = '查看我的初步结果'
      heroTitle = '你的初步结果已经形成'
      heroDesc = '结果目前只保存在当前设备，由你决定是否保存并继续建立个人档案。'
    } else if (explorationExists && Object.keys(exploration.answers || {}).length) {
      actionText = '继续这次探索'
      heroTitle = '从刚才的位置继续'
      heroDesc = '已回答的选择保存在当前设备，完成 5 题后即可查看初步描述。'
    }
    this.setData({
      hasSavedProfile: exists,
      actionText,
      heroTitle,
      heroDesc
    })
  },

  restoreCloudProfile() {
    if (!isCloudReady() || this.data.isRestoring) return
    const localExists = hasProfile()
    const localProfile = getProfile()
    if (localExists && localProfile.status === 'draft') return

    this.setData({ isRestoring: true })
    getProfileFromCloud({
      success: data => {
        const remoteProfile = data.profile
        const remoteExploration = data.exploration
        const remoteFeedback = data.recordFeedback
        const remoteQuestionnaire = data.questionnaireData
        const localExploration = getExploration()
        const localFeedback = getRecordFeedback()
        const canRestoreExploration = remoteExploration && (
          !hasExploration() || Number(remoteExploration.savedAt) > Number(localExploration.updatedAt)
        )
        if (canRestoreExploration) replaceExploration(remoteExploration)
        const canRestoreFeedback = remoteFeedback && Number(remoteFeedback.updatedAt) > Number(localFeedback.updatedAt)
        if (canRestoreFeedback) replaceRecordFeedback(remoteFeedback)
        const localQuestionnaire = getQuestionnaireData()
        const canRestoreQuestionnaire = remoteQuestionnaire && Number(remoteQuestionnaire.updatedAt) > Number(localQuestionnaire.updatedAt)
        if (canRestoreQuestionnaire) replaceQuestionnaireData(remoteQuestionnaire)
        const canReplace = remoteProfile && (
          !localExists ||
          (!needsCloudSync(localProfile) && Number(remoteProfile.updatedAt) > Number(localProfile.updatedAt))
        )
        if (canReplace) {
          replaceProfile(remoteProfile)
          markCloudSynced(remoteProfile)
          this.refreshLocalState()
        }
        if (canRestoreExploration || canRestoreFeedback || canRestoreQuestionnaire) this.refreshLocalState()
        this.setData({ isRestoring: false })
      },
      fail: () => this.setData({ isRestoring: false })
    })
  },

  handleStart() {
    if (this._isRouting || this.data.isRestoring) return
    recordEvent('start_click')
    if (hasProfile()) {
      navigateOnce(this, 'navigateTo', {
        url: '/pages/relationship-map/index',
        fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
      })
      return
    }

    const exploration = getExploration()
    if (hasExploration() && exploration.status === 'complete') {
      navigateOnce(this, 'navigateTo', { url: '/pages/exploration-result/index' })
      return
    }
    if (hasExploration() && exploration.status === 'saved') {
      navigateOnce(this, 'navigateTo', { url: '/pages/relationship-map/index' })
      return
    }
    const question = Number.isInteger(exploration.currentQuestion) ? exploration.currentQuestion : 0
    navigateOnce(this, 'navigateTo', { url: `/pages/exploration/index?question=${question}` })
  },

  openGuide() {
    this.setData({ showGuide: true })
  },

  closeGuide() {
    this.setData({ showGuide: false })
  },

  handleGuideVisibleChange(event) {
    this.setData({ showGuide: event.detail.visible })
  }
})
