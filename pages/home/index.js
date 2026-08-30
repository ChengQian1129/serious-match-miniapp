const { getSession, hasSession, getReport, shouldSyncAssessment, replaceSession, replaceReport } = require('../../utils/assessment-v2/session-store')
const cloud = require('../../utils/cloud')
const { isCloudReady, getAssessmentFromCloud, getProductV0FromCloud } = cloud
const { CHAPTERS } = require('../../utils/assessment-v2/questionnaire-definitions')
const { FEATURES } = require('../../utils/features')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')
const { home, guide, CONTENT_VERSION } = require('../../shared/content/ui-copy')

function progressPercentLabel(ratio) {
  if (ratio > 0 && ratio < 0.01) return '<1%'
  return `${Math.round(ratio * 100)}%`
}

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
    guideCloseAction: guide.closeAction,
    progressText: '',
    privacyAction: home.privacyAction,
    productDeleteAction: home.deleteAction,
    productDeleteDialogTitle: home.deleteDialogTitle,
    productDeleteDialogContent: home.deleteDialogContent,
    productDeleteConfirm: home.deleteConfirm,
    productDeleteCancel: home.deleteCancel,
    productDeleteSuccess: home.deleteSuccess,
    productRetryAction: home.retryAction,
    productHasData: false,
    productDeleting: false,
    productSyncError: ''
  },

  onShow() {
    resetNavigation(this)
    if (FEATURES.v3ProductV0) return this.onProductShow()
    const report = getReport()
    const session = getSession()
    if (report && !session.revisionPending) {
      this.setData({ actionText: '查看结果', heroTitle: home.completedTitle, heroDesc: home.completedDescription, progressText: '' })
    } else if (hasSession() && Object.keys(session.answers).length) {
      const chapterIndex = Math.max(0, CHAPTERS.findIndex(chapter => chapter.id === session.currentChapterId))
      this.setData({ actionText: '继续答题', heroTitle: home.progressTitle, heroDesc: `第 ${chapterIndex + 1} 部分 / 6。之前的回答都还在，接着答就行。`, progressText: `${Object.keys(session.answers).length} / 48` })
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

  onProductShow() {
    this._productRestoreCancelled = false
    const session = productStore.getSession()
    this.applyProductState(session)
    if (isCloudReady() && !this._productRestoreAttempted) {
      const restoreToken = (this._productRestoreToken || 0) + 1
      this._productRestoreToken = restoreToken
      this._productRestoreAttempted = true
      getProductV0FromCloud(productStore.hasSession() ? session.assessmentId : '', {
        success: data => {
          if (restoreToken !== this._productRestoreToken || this._productRestoreCancelled) return
          const local = productStore.getSession()
          if (data.session && (!productStore.hasSession() || Number(data.session.updatedAt) > Number(local.updatedAt))) productStore.replaceSession(data.session)
          if (data.session && data.session.status !== 'completed') productStore.clearReport()
          const localReport = productStore.getReport()
          const cloudReport = data.report
          const cloudVersion = Number(cloudReport && cloudReport.reportVersion) || 0
          const localVersion = Number(localReport && localReport.reportVersion) || 0
          const cloudGeneratedAt = Number(cloudReport && cloudReport.generatedAt) || Number(data.session && data.session.completedAt) || 0
          const localGeneratedAt = Number(localReport && localReport.generatedAt) || Number(local.completedAt) || 0
          if (cloudReport && (!localReport || cloudVersion > localVersion || (cloudVersion === localVersion && cloudGeneratedAt > localGeneratedAt))) productStore.replaceReport(cloudReport)
          this.applyProductState(productStore.getSession())
          this.setData({ productSyncError: '' })
          this._productRestoreAttempted = false
        },
        fail: error => { this._productRestoreAttempted = false; this.setData({ productSyncError: cloud.cloudErrorMessage(error) }) }
      })
    }
    recordEvent('home_view')
  },

  applyProductState(session) {
    const report = productStore.getReport()
    const hasData = productStore.hasSession()
    if (session.status === 'completed' && (session.derivedProfile || report)) {
      return this.setData({ actionText: '查看结果', heroTitle: home.completedTitle, heroDesc: home.completedDescription, progressText: '', productHasData: hasData })
    }
    if (hasData) {
      const progress = productRuntime.progress(session)
      const progressDesc = (home.progressDescriptionTemplate || '').replace('{completed}', String(progress.completedParents)).replace('{total}', String(progress.assignedParents))
      return this.setData({ actionText: '继续答题', heroTitle: home.progressTitle, heroDesc: progressDesc, progressText: '', productHasData: true })
    }
    this.setData({ actionText: home.action, heroTitle: home.title, heroDesc: home.description, progressText: '', productHasData: false })
  },

  handleStart() {
    if (this._isRouting) return
    if (FEATURES.v3ProductV0) {
      this._productRestoreCancelled = true
      this._productRestoreToken = (this._productRestoreToken || 0) + 1
      this._productRestoreAttempted = false
      const session = productStore.getSession()
      if (session.status === 'completed' && (session.derivedProfile || productStore.getReport())) return navigateOnce(this, 'navigateTo', { url: '/pages/v3-result/index?mode=product-v0' })
      return this.beginAssessment()
    }
    const report = getReport()
    const session = getSession()
    if (report && !session.revisionPending) return navigateOnce(this, 'navigateTo', { url: '/pages/questionnaire-result/index' })
    this.beginAssessment()
  },

  beginAssessment() {
    if (FEATURES.v3ProductV0) {
      const session = productStore.getSession()
      return navigateOnce(this, 'navigateTo', { url: `/pages/questionnaire-v3/index?index=${session.currentTaskIndex || 0}` })
    }
    const session = getSession()
    navigateOnce(this, 'navigateTo', { url: `/pages/questionnaire/index?chapter=${session.currentChapterId}&question=${session.currentItemIndex || 0}` })
  },

  openPrivacy() { navigateOnce(this, 'navigateTo', { url: '/pages/privacy/index' }) },

  retryProductSync() {
    this._productRestoreAttempted = false
    this.onProductShow()
  },

  deleteProductData() {
    if (!FEATURES.v3ProductV0 || this.data.productDeleting) return
    const removeLocal = () => {
      productStore.resetSession()
      this.setData({ productDeleting: false, productHasData: false, productSyncError: '' })
      this.applyProductState(productStore.getSession())
      if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') wx.showToast({ title: this.data.productDeleteSuccess, icon: 'success' })
    }
    const remove = () => {
      // A restore can still be in flight when the user confirms deletion.
      // Invalidate that response before starting the destructive operation so
      // an older cloud snapshot cannot repopulate the local session afterward.
      this._productRestoreCancelled = true
      this._productRestoreToken = (this._productRestoreToken || 0) + 1
      this._productRestoreAttempted = false
      this.setData({ productDeleting: true, productSyncError: '' })
      if (!cloud.isCloudReady()) return removeLocal()
      cloud.deleteProductV0FromCloud({
        success: removeLocal,
        fail: error => this.setData({ productDeleting: false, productSyncError: cloud.cloudErrorMessage(error) })
      })
    }
    if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') return remove()
    wx.showModal({ title: this.data.productDeleteDialogTitle, content: this.data.productDeleteDialogContent, confirmText: this.data.productDeleteConfirm, cancelText: this.data.productDeleteCancel, success: result => { if (result.confirm) remove() } })
  },

  openGuide() { this.setData({ showGuide: true }) },
  closeGuide() { this.setData({ showGuide: false }) },
  handleGuideVisibleChange(event) { this.setData({ showGuide: event.detail.visible }) }
})
