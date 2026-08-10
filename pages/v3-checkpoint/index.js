const { FEATURES } = require('../../utils/features')
const { CHAPTERS } = require('../../shared/assessment-v3-product/contract')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildChapterView, PRODUCT_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

function chapterIndex(chapterId) {
  const index = CHAPTERS.findIndex(chapter => chapter.id === chapterId)
  return index >= 0 ? index : 0
}

function chapterView(personaId, chapterId) {
  const report = buildReport(getFixture(personaId))
  const currentIndex = chapterIndex(chapterId)
  const currentId = CHAPTERS[currentIndex].id
  const current = buildChapterView(report, currentId)
  const next = CHAPTERS[currentIndex + 1] ? buildChapterView(report, CHAPTERS[currentIndex + 1].id) : null
  return { report, current, next, number: currentIndex + 1, hasNext: Boolean(next) }
}

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    chapter: null,
    number: 1,
    chapterNumberText: '',
    hasNext: false,
    personaId: ''
  },

  onLoad(options = {}) {
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.chapterId = options.chapter || 'C1'
    this.loadChapter()
  },

  onShow() { resetNavigation(this) },

  loadChapter() {
    const view = chapterView(this.personaId, this.chapterId)
    this.setData({ ready: true, personaId: this.personaId, chapter: view.current, number: view.number, chapterNumberText: PRODUCT_COPY.preview.chapterNumber.replace('{number}', String(view.number)), hasNext: view.hasNext })
  },

  openEvidence(event) {
    const dimensionId = event.currentTarget.dataset.dimensionId
    if (!dimensionId) return
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result-evidence/index?persona=${encodeURIComponent(this.personaId)}&dimension=${encodeURIComponent(dimensionId)}` })
  },

  continueNext() {
    const nextIndex = chapterIndex(this.chapterId) + 1
    const nextChapter = CHAPTERS[nextIndex]
    if (nextChapter) {
      navigateOnce(this, 'redirectTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.personaId)}&chapter=${nextChapter.id}` })
    } else {
      navigateOnce(this, 'redirectTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}` })
    }
  },

  openResult() {
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}` })
  },

  backToPreview() {
    navigateOnce(this, 'reLaunch', { url: `/pages/v3-product-preview/index?persona=${encodeURIComponent(this.personaId)}` })
  }
})

module.exports = { chapterIndex, chapterView }
