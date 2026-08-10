const { FEATURES } = require('../../utils/features')
const { CHAPTERS } = require('../../shared/assessment-v3-product/contract')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildChapterView, PRODUCT_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

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
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.loadReport()
  },

  onShow() { resetNavigation(this); if (this.personaId) this.loadReport() },

  loadReport() {
    const report = buildReport(getFixture(this.personaId))
    this.setData({ ready: true, report, chapters: chapterViews(report), personaId: this.personaId })
  },

  openEvidence(event) {
    const dimensionId = event.currentTarget.dataset.dimensionId
    if (!dimensionId) return
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result-evidence/index?persona=${encodeURIComponent(this.personaId)}&dimension=${encodeURIComponent(dimensionId)}` })
  },

  openChapter(event) {
    const chapterId = event.currentTarget.dataset.chapterId
    if (!chapterId) return
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.personaId)}&chapter=${encodeURIComponent(chapterId)}` })
  },

  restart() {
    navigateOnce(this, 'reLaunch', { url: `/pages/v3-product-preview/index?persona=${encodeURIComponent(this.personaId)}` })
  },

  startAtFirstChapter() {
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.personaId)}&chapter=C1` })
  }
})

module.exports = { chapterViews }
