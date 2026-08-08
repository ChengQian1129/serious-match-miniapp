const { getSession, hasSession, getReport, getStorageChoice, setStorageChoice, shouldSyncAssessment, replaceSession, replaceReport } = require('../../utils/assessment-v2/session-store')
const { isCloudReady, getAssessmentFromCloud } = require('../../utils/cloud')
const { CHAPTERS } = require('../../utils/assessment-v2/questionnaire-definitions')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')
const { home, guide, storage: storageCopy, CONTENT_VERSION } = require('../../shared/content/ui-copy')

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    showGuide: false,
    contentVersion: CONTENT_VERSION,
    actionText: home.action,
    heroTitle: home.title,
    heroDesc: home.description,
    exampleLabel: home.exampleLabel,
    exampleText: home.example,
    topicsTitle: home.topicsTitle,
    topics: home.topics,
    followupHint: home.followupHint,
    guideTitle: guide.title,
    guideBody: guide.body,
    guideFocus: guide.focus,
    guideAction: guide.detailAction,
    storageTitle: storageCopy.title,
    storageBody: storageCopy.body,
    storageCloudLabel: storageCopy.cloud,
    storageLocalLabel: storageCopy.local,
    progressText: '',
    showStorageChoice: false
  },

  onShow() {
    resetNavigation(this)
    const report = getReport()
    const session = getSession()
    if (report && !session.revisionPending) {
      this.setData({ actionText: '打开说明书', heroTitle: home.completedTitle, heroDesc: home.completedDescription, progressText: '这份说明书可以随时修改' })
    } else if (hasSession() && Object.keys(session.answers).length) {
      const chapterIndex = Math.max(0, CHAPTERS.findIndex(chapter => chapter.id === session.currentChapterId))
      this.setData({ actionText: '继续', heroTitle: home.progressTitle, heroDesc: `第 ${chapterIndex + 1} 组 / 6。之前的回答都还在，接着答就行。`, progressText: `${Object.keys(session.answers).length} / 48` })
    }
    if (isCloudReady() && shouldSyncAssessment() && !this._restoreAttempted) {
      this._restoreAttempted = true
      getAssessmentFromCloud(hasSession() ? session.assessmentId : '', {
        success: data => {
          if (data.session && (!hasSession() || Number(data.session.updatedAt) > Number(getSession().updatedAt))) replaceSession(data.session)
          const localReport = getReport()
          const cloudReport = data.report
          const cloudVersion = Number(cloudReport && cloudReport.reportVersion) || 0
          const localVersion = Number(localReport && localReport.reportVersion) || 0
          const cloudGeneratedAt = Number(cloudReport && cloudReport.generatedAt) || 0
          const localGeneratedAt = Number(localReport && localReport.generatedAt) || 0
          if (cloudReport && (!localReport || cloudVersion > localVersion || (cloudVersion === localVersion && cloudGeneratedAt > localGeneratedAt))) replaceReport(cloudReport)
          if (data.session || data.report) this.onShow()
        },
        fail: () => { this._restoreAttempted = false }
      })
    }
    recordEvent('home_view')
  },

  handleStart() {
    if (this._isRouting) return
    const report = getReport()
    const session = getSession()
    if (report && !session.revisionPending) return navigateOnce(this, 'navigateTo', { url: '/pages/questionnaire-result/index' })
    if (!getStorageChoice()) return this.setData({ showStorageChoice: true })
    this.beginAssessment()
  },

  beginAssessment() {
    const session = getSession()
    navigateOnce(this, 'navigateTo', { url: `/pages/questionnaire/index?chapter=${session.currentChapterId}&question=${session.currentItemIndex || 0}` })
  },

  chooseCloudStorage() { setStorageChoice('cloud'); this.setData({ showStorageChoice: false }); this.beginAssessment() },
  chooseLocalStorage() { setStorageChoice('local'); this.setData({ showStorageChoice: false }); this.beginAssessment() },
  closeStorageChoice() { this.setData({ showStorageChoice: false }) },
  handleStorageVisibleChange(event) { this.setData({ showStorageChoice: Boolean(event.detail && event.detail.visible) }) },

  openGuide() { this.setData({ showGuide: true }) },
  closeGuide() { this.setData({ showGuide: false }) },
  handleGuideVisibleChange(event) { this.setData({ showGuide: event.detail.visible }) }
})
