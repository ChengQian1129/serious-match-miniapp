const { getSession, hasSession, getReport, shouldSyncAssessment, replaceSession, replaceReport } = require('../../utils/assessment-v2/session-store')
const cloud = require('../../utils/cloud')
const { isCloudReady, getAssessmentFromCloud } = cloud
const { CHAPTERS } = require('../../utils/assessment-v2/questionnaire-definitions')
const { FEATURES } = require('../../utils/features')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')
const productJourney = require('../../utils/assessment-v3-product-v0/journey-model')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')
const { home, guide, CONTENT_VERSION } = require('../../shared/content/ui-copy')
const PRODUCT_V0_COPY = require('../../shared/content/public-language.generated').v3.productV0

function progressPercentLabel(ratio) {
  if (ratio > 0 && ratio < 0.01) return '<1%'
  return `${Math.round(ratio * 100)}%`
}

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    showGuide: false,
    contentVersion: CONTENT_VERSION,
    isProductMode: FEATURES.v3ProductV0,
    productCopy: PRODUCT_V0_COPY,
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
    productSyncError: '',
    productRestoreState: 'INITIALIZING',
    productRestoreError: '',
    productCanStart: !FEATURES.v3ProductV0,
    productCanUseLocal: false,
    productCanUseCloud: false,
    productSectionTitle: '',
    productSectionProgress: '',
    productCompletedSections: '',
    productSaveLabel: ''
  },

  onLoad(options = {}) {
    this.startIntent = options.intent === 'start'
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
    if (!this._productRestoreAttempted) this._productRestoreCancelled = false
    const session = productStore.getSession()
    if (!cloud.isCloudReady()) {
      this.applyProductState(session, { restoreState: 'RESTORE_ERROR', restoreError: cloud.getSetupIssue() || (PRODUCT_V0_COPY.errors && PRODUCT_V0_COPY.errors.restoreFailed) })
      this.setData({ productSyncError: cloud.getSetupIssue() || (PRODUCT_V0_COPY.errors && PRODUCT_V0_COPY.errors.restoreFailed) || '' })
      recordEvent('assessment_restore_fail', { networkState: 'unavailable' })
      recordEvent('home_view')
      return
    }
    this.applyProductState(session, { restoreState: 'RESTORING' })
    if (!this._productRestoreAttempted) {
      const restoreToken = (this._productRestoreToken || 0) + 1
      this._productRestoreToken = restoreToken
      this._productRestoreAttempted = true
      recordEvent('assessment_restore_start')
      cloud.getProductV0FromCloud(productStore.hasSession() ? session.assessmentId : '', {
        success: data => {
          if (restoreToken !== this._productRestoreToken || this._productRestoreCancelled) return
          const local = productStore.getSession()
          const localHasUnsyncedAnswers = local.answerEvents.length > 0 && local.status === 'pending_cloud'
          const remoteIsNewer = data.session && Number(data.session.updatedAt) > Number(local.updatedAt)
          if (remoteIsNewer && localHasUnsyncedAnswers) {
            this._productRemoteCandidate = data
            this._productRestoreAttempted = true
            this.setData({
              productRestoreState: 'RESTORE_CONFLICT',
              productRestoreError: PRODUCT_V0_COPY.home.conflictDescription,
              productSyncError: PRODUCT_V0_COPY.home.conflictError,
              productCanStart: false,
              productCanUseLocal: true,
              productCanUseCloud: true,
              productHasData: true
            })
            recordEvent('assessment_restore_fail', { networkState: 'conflict' })
            return
          }
          if (data.session && (!productStore.hasSession() || remoteIsNewer)) productStore.replaceSession(data.session)
          if (data.session && data.session.status !== 'completed') productStore.clearReport()
          const localReport = productStore.getReport()
          const cloudReport = data.report
          const cloudVersion = Number(cloudReport && cloudReport.reportVersion) || 0
          const localVersion = Number(localReport && localReport.reportVersion) || 0
          const cloudGeneratedAt = Number(cloudReport && cloudReport.generatedAt) || Number(data.session && data.session.completedAt) || 0
          const localGeneratedAt = Number(localReport && localReport.generatedAt) || Number(local.completedAt) || 0
          if (cloudReport && (!localReport || cloudVersion > localVersion || (cloudVersion === localVersion && cloudGeneratedAt > localGeneratedAt))) productStore.replaceReport(cloudReport)
          this._productRestoreAttempted = false
          this._productRemoteCandidate = null
          this.applyProductState(productStore.getSession(), { restoreState: 'READY' })
          this.setData({ productSyncError: '', productRestoreError: '' })
          recordEvent('assessment_restore_success', { networkState: 'online' })
          this.orchestrateStartIntent()
        },
        fail: error => {
          if (restoreToken !== this._productRestoreToken || this._productRestoreCancelled) return
          this._productRestoreAttempted = false
          const message = cloud.cloudErrorMessage(error)
          this.applyProductState(productStore.getSession(), { restoreState: 'RESTORE_ERROR', restoreError: message })
          this.setData({ productSyncError: message, productRestoreError: message })
          recordEvent('assessment_restore_fail', { networkState: 'online' })
        }
      })
    }
    recordEvent('home_view')
  },

  applyProductState(session, options = {}) {
    const report = productStore.getReport()
    const hasData = productStore.hasSession()
    const restoreState = options.restoreState || this.data.productRestoreState || 'READY'
    const localProgress = productJourney.getGlobalProgress(session)
    const section = productJourney.currentSection(session)
    const sectionProgress = section ? productJourney.getSectionProgress(session, section.id) : { completedTasks: 0, totalTasks: 0 }
    const productHome = PRODUCT_V0_COPY.home || {}
    const sectionProgressText = (productHome.sectionProgressTemplate || '{sectionCompleted} / {sectionTotal}')
      .replace('{sectionCompleted}', String(sectionProgress.completedTasks))
      .replace('{sectionTotal}', String(sectionProgress.totalTasks))
    const completedSectionsText = (productHome.completedSectionsTemplate || '已完成 {completed} / {total} 个部分')
      .replace('{completed}', String(localProgress.completedSections))
      .replace('{total}', String(localProgress.totalSections))
    const base = {
      productRestoreState: restoreState,
      productRestoreError: options.restoreError || '',
      productHasData: hasData,
      productCanStart: restoreState === 'READY' && !this.data.productDeleting,
      productCanUseLocal: restoreState === 'RESTORE_ERROR' && hasData,
      productCanUseCloud: restoreState === 'RESTORE_CONFLICT' && Boolean(this._productRemoteCandidate),
      productSectionTitle: section ? section.title : '',
      productSectionProgress: sectionProgressText,
      productCompletedSections: completedSectionsText,
      productSaveLabel: session.status === 'pending_cloud' ? (productHome.localOnlyLabel || '') : (session.answerEvents.length ? (productHome.syncedLabel || '') : '')
    }
    if (restoreState === 'RESTORING') {
      return this.setData(Object.assign(base, { actionText: productHome.restoringTitle || '正在恢复进度…', heroTitle: productHome.restoringTitle || '正在恢复进度', heroDesc: productHome.restoringDescription || '', progressText: '', productCanStart: false }))
    }
    if (restoreState === 'RESTORE_CONFLICT') {
      return this.setData(Object.assign(base, { actionText: productHome.conflictTitle || '选择进度', heroTitle: productHome.conflictTitle || '两台设备的进度不一样', heroDesc: productHome.conflictDescription || '', progressText: '', productCanStart: false }))
    }
    if (restoreState === 'RESTORE_ERROR') {
      const title = productHome.restoreErrorTitle || '暂时没能确认云端进度'
      return this.setData(Object.assign(base, { actionText: productHome.retryAction || '重试', heroTitle: title, heroDesc: productHome.restoreErrorDescription || options.restoreError || '', progressText: '', productCanStart: true }))
    }
    if (session.status === 'completed' && (session.derivedProfile || report) && productJourney.isAssessmentComplete(session)) {
      return this.setData(Object.assign(base, { actionText: productHome.viewResultAction || '查看结果', heroTitle: productHome.readyCompletedTitle || '你的结果已经生成', heroDesc: productHome.readyCompletedDescription || '', progressText: '' }))
    }
    if (hasData) {
      return this.setData(Object.assign(base, { actionText: productHome.continueAction || '继续', heroTitle: productHome.readyLocalTitle || '继续填写你的答题', heroDesc: productHome.readyLocalDescription || '', progressText: '' }))
    }
    return this.setData(Object.assign(base, { actionText: productHome.startAction || '开始', heroTitle: productHome.readyNewTitle || home.title, heroDesc: productHome.readyNewDescription || home.description, progressText: '' }))
  },

  orchestrateStartIntent() {
    if (!this.startIntent || this._startIntentHandled || this.data.productRestoreState !== 'READY' || !this.data.productCanStart) return
    this._startIntentHandled = true
    recordEvent('assessment_start')
    this.beginAssessment()
  },

  handleStart() {
    if (this._isRouting) return
    if (FEATURES.v3ProductV0) {
      if (this.data.productRestoreState === 'RESTORING') return
      if (this.data.productRestoreState === 'RESTORE_ERROR') return this.retryProductSync()
      if (this.data.productRestoreState === 'RESTORE_CONFLICT') return
      if (!this.data.productCanStart) return
      const session = productStore.getSession()
      recordEvent('assessment_start')
      if (session.status === 'completed' && (session.derivedProfile || productStore.getReport()) && productJourney.isAssessmentComplete(session)) return navigateOnce(this, 'navigateTo', { url: '/pages/v3-result/index?mode=product-v0' })
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
    this._productRestoreCancelled = false
    this.setData({ productSyncError: '', productRestoreError: '', productRestoreState: 'INITIALIZING', productCanStart: false })
    this.onProductShow()
  },

  useLocalProgress() {
    if (this.data.productRestoreState !== 'RESTORE_CONFLICT' && this.data.productRestoreState !== 'RESTORE_ERROR') return
    this._productRemoteCandidate = null
    this._productRestoreAttempted = true
    this.applyProductState(productStore.getSession(), { restoreState: 'READY' })
    this.setData({ productSyncError: '', productRestoreError: '' })
    recordEvent('assessment_offline_continue', { networkState: 'local' })
    this.orchestrateStartIntent()
  },

  useCloudProgress() {
    if (!this._productRemoteCandidate || !this._productRemoteCandidate.session) return
    const remote = this._productRemoteCandidate
    productStore.replaceSession(remote.session)
    if (remote.report) productStore.replaceReport(remote.report)
    else productStore.clearReport()
    this._productRemoteCandidate = null
    this._productRestoreAttempted = true
    this.applyProductState(productStore.getSession(), { restoreState: 'READY' })
    this.setData({ productSyncError: '', productRestoreError: '' })
    recordEvent('assessment_restore_success', { networkState: 'cloud_selected' })
    this.orchestrateStartIntent()
  },

  startOffline() {
    if (this.data.productRestoreState !== 'RESTORE_ERROR' || productStore.hasSession()) return
    const start = () => {
      productStore.saveSession(productStore.emptySession())
      this._productRestoreAttempted = true
      this.setData({ productSyncError: '', productRestoreError: '' })
      this.applyProductState(productStore.getSession(), { restoreState: 'READY' })
      recordEvent('assessment_offline_continue', { networkState: 'offline_new' })
      this.orchestrateStartIntent()
      if (!this.startIntent) this.beginAssessment()
    }
    if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') return start()
    wx.showModal({ title: PRODUCT_V0_COPY.home.offlineDialogTitle, content: PRODUCT_V0_COPY.home.offlineDialogContent, confirmText: PRODUCT_V0_COPY.home.offlineConfirm, cancelText: PRODUCT_V0_COPY.home.cancelAction, success: result => { if (result.confirm) start() } })
  },

  deleteProductData() {
    if (!FEATURES.v3ProductV0 || this.data.productDeleting) return
    const removeLocal = () => {
      productStore.resetSession()
      this._productRemoteCandidate = null
      this.setData({ productDeleting: false, productHasData: false, productSyncError: '', productRestoreError: '' })
      this.applyProductState(productStore.getSession(), { restoreState: 'READY' })
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
