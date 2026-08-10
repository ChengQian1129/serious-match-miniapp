const { FEATURES } = require('../../utils/features')
const { CHAPTERS } = require('../../shared/assessment-v3-product/contract')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildChapterView, PRODUCT_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')

function chapterViews(report) {
  return CHAPTERS.map(chapter => buildChapterView(report, chapter.id)).filter(Boolean)
}

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    report: null,
    chapters: [],
    personaId: ''
  },

  onLoad(options = {}) {
    if (options.mode === 'product-v0') {
      if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      this.mode = 'product-v0'
      this.loadReport()
      return
    }
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.loadReport()
  },

  onShow() { resetNavigation(this); if (this.mode === 'product-v0' || this.personaId) this.loadReport() },

  loadReport() {
    const report = this.mode === 'product-v0'
      ? buildReport(productStore.getSession().derivedProfile || productRuntime.deriveProfile(productStore.getSession()))
      : buildReport(getFixture(this.personaId))
    this.setData({ ready: true, report, chapters: chapterViews(report), personaId: this.personaId || '' })
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

  restart() {
    if (this.mode === 'product-v0') {
      productStore.resetSession()
      return navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-v3/index' })
    }
    navigateOnce(this, 'reLaunch', { url: `/pages/v3-product-preview/index?persona=${encodeURIComponent(this.personaId)}` })
  },

  startAtFirstChapter() {
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateTo', { url: '/pages/questionnaire-v3/index' })
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.personaId)}&chapter=C1` })
  }
})

module.exports = { chapterViews }
