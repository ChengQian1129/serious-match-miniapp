const { FEATURES } = require('../../utils/features')
const { CHAPTERS } = require('../../shared/assessment-v3-product/contract')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildChapterView, PRODUCT_COPY, PRODUCT_V0_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')
const cloud = require('../../utils/cloud')

function chapterViews(report) {
  return CHAPTERS.map(chapter => buildChapterView(report, chapter.id)).filter(Boolean).map(chapter => Object.assign({}, chapter, { expanded: false }))
}

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    report: null,
    chapters: [],
    personaId: '',
    syncing: false,
    syncError: ''
  },

  onLoad(options = {}) {
    if (options.mode === 'product-v0') {
      if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      this.mode = 'product-v0'
      this.setData({ copy: PRODUCT_V0_COPY })
      this.loadReport()
      return
    }
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.loadReport()
  },

  onShow() {
    resetNavigation(this)
    if (this.mode === 'product-v0' || this.personaId) {
      this.loadReport()
      if (this.mode === 'product-v0') this.syncProductReport()
    }
  },

  loadReport() {
    if (this.mode === 'product-v0') {
      const session = productStore.getSession()
      if (!session.completedAt) return navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire-v3/index' })
      let report = productStore.getReport()
      if (!report || report.source !== 'THEORY_DRIVEN_PRODUCT_V0') {
        if (!session.derivedProfile) return navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire-v3/index' })
        report = Object.assign({ reportVersion: 1, generatedAt: session.completedAt || Date.now() }, buildReport(session.derivedProfile))
        productStore.saveReport(report)
      }
      this.setData({ ready: true, copy: PRODUCT_V0_COPY, report, chapters: chapterViews(report), personaId: '', syncError: '' })
      return
    }
    const report = buildReport(getFixture(this.personaId))
    this.setData({ ready: true, copy: PRODUCT_COPY, report, chapters: chapterViews(report), personaId: this.personaId || '' })
  },

  syncProductReport() {
    if (this._productSyncing || this._productMutationInFlight || !cloud.isCloudReady()) return
    const session = productStore.getSession()
    if (!session.completedAt || !session.answerEvents.length) return
    const report = productStore.getReport()
    if (report && report._id && session.status === 'completed') return
    this._productSyncing = true
    const syncToken = (this._productSyncToken || 0) + 1
    this._productSyncToken = syncToken
    this.setData({ syncing: true, syncError: '' })
    cloud.completeProductV0ToCloud(session, {
      success: data => {
        this._productSyncing = false
        if (syncToken !== this._productSyncToken || this._productMutationInFlight) return
        if (data && data.session) productStore.replaceSession(data.session)
        if (data && data.report) productStore.replaceReport(data.report)
        this.setData({ syncing: false, syncError: '' })
        this.loadReport()
      },
      fail: error => {
        this._productSyncing = false
        if (syncToken !== this._productSyncToken || this._productMutationInFlight) return
        this.setData({ syncing: false, syncError: cloud.cloudErrorMessage(error) })
      }
    })
  },

  beginProductMutation() {
    this._productSyncToken = (this._productSyncToken || 0) + 1
    this._productSyncing = false
    this._productMutationInFlight = true
  },

  endProductMutation() {
    this._productMutationInFlight = false
  },

  openEvidence(event) {
    const dimensionId = event.currentTarget.dataset.dimensionId
    if (!dimensionId) return
    const query = this.mode === 'product-v0' ? `mode=product-v0&dimension=${encodeURIComponent(dimensionId)}` : `persona=${encodeURIComponent(this.personaId)}&dimension=${encodeURIComponent(dimensionId)}`
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result-evidence/index?${query}` })
  },

  openChapter(event) {
    const chapterId = event.currentTarget.dataset.chapterId
    if (!chapterId) return
    const query = this.mode === 'product-v0' ? `mode=product-v0&chapter=${encodeURIComponent(chapterId)}` : `persona=${encodeURIComponent(this.personaId)}&chapter=${encodeURIComponent(chapterId)}`
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?${query}` })
  },

  toggleChapter(event) {
    const chapterId = event.currentTarget.dataset.chapterId
    if (!chapterId) return
    const chapters = this.data.chapters.map(chapter => chapter.id === chapterId ? Object.assign({}, chapter, { expanded: !chapter.expanded }) : chapter)
    this.setData({ chapters })
  },

  openFollowup() {
    if (this.mode !== 'product-v0') return
    navigateOnce(this, 'navigateTo', { url: '/pages/followup-intro/index?returnTo=product-v0' })
  },

  restart() {
    if (this.mode === 'product-v0') {
      const restart = () => {
        if (this._restarting) return
        this._restarting = true
        this.beginProductMutation()
        if (!cloud.isCloudReady()) {
          productStore.resetSession()
          this.endProductMutation()
          return navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-v3/index' })
        }
        this.setData({ syncing: true, syncError: '' })
        cloud.deleteProductV0FromCloud({
          success: () => { productStore.resetSession(); this.endProductMutation(); navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-v3/index' }) },
          fail: error => { this.endProductMutation(); this._restarting = false; this.setData({ syncing: false, syncError: cloud.cloudErrorMessage(error) }) }
        })
      }
      if (typeof wx !== 'undefined' && typeof wx.showModal === 'function') return wx.showModal({ title: PRODUCT_V0_COPY.preview.restartDialogTitle, content: PRODUCT_V0_COPY.preview.restartDialogContent, confirmText: PRODUCT_V0_COPY.preview.restartConfirm, cancelText: PRODUCT_V0_COPY.preview.deleteCancel, success: result => { if (result.confirm) restart() } })
      return restart()
    }
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  requestDelete() {
    if (this.mode !== 'product-v0' || this._deleting) return
    const remove = () => {
      productStore.resetSession()
      this.endProductMutation()
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    }
    const startRemove = () => {
      this._deleting = true
      this.beginProductMutation()
      this.setData({ syncing: true, syncError: '' })
      if (typeof wx === 'undefined' || !cloud.isCloudReady()) return remove()
      cloud.deleteProductV0FromCloud({
        success: remove,
        fail: error => { this._deleting = false; this.endProductMutation(); this.setData({ syncing: false, syncError: cloud.cloudErrorMessage(error) }) }
      })
    }
    if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') return startRemove()
    wx.showModal({ title: PRODUCT_V0_COPY.preview.deleteDialogTitle, content: PRODUCT_V0_COPY.preview.deleteDialogContent, confirmText: PRODUCT_V0_COPY.preview.deleteConfirm, cancelText: PRODUCT_V0_COPY.preview.deleteCancel, success: result => {
      if (!result.confirm) return
      startRemove()
    } })
  },

  startAtFirstChapter() {
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateTo', { url: '/pages/questionnaire-v3/index?index=0' })
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.personaId)}&chapter=C1` })
  }
})

module.exports = { chapterViews }
