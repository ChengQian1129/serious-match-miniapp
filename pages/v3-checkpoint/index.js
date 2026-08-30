const { FEATURES } = require('../../utils/features')
const { CHAPTERS } = require('../../shared/assessment-v3-product/contract')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildChapterView, PRODUCT_COPY, PRODUCT_V0_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')

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

function productChapterView(chapterId) {
  const session = productStore.getSession()
  const profile = session.derivedProfile || productRuntime.deriveProfile(session)
  const report = buildReport(profile)
  const currentId = CHAPTERS[chapterIndex(chapterId)].id
  const current = buildChapterView(report, currentId)
  return { report, current, next: null, number: chapterIndex(currentId) + 1, hasNext: false }
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
    if (options.mode === 'product-v0') {
      if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      this.mode = 'product-v0'
      this.chapterId = options.chapter || 'C1'
      this.nextIndex = options.nextIndex
      this.setData({ copy: PRODUCT_V0_COPY })
      this.loadChapter()
      return
    }
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.chapterId = options.chapter || 'C1'
    this.loadChapter()
  },

  onShow() { resetNavigation(this) },

  loadChapter() {
    if (this.mode === 'product-v0') {
      const view = productChapterView(this.chapterId)
      this.setData({ ready: true, mode: this.mode, copy: PRODUCT_V0_COPY, chapter: view.current, number: view.number, chapterNumberText: PRODUCT_V0_COPY.preview.chapterNumber.replace('{number}', String(view.number)), hasNext: this.nextIndex !== undefined, personaId: '' })
      return
    }
    const view = chapterView(this.personaId, this.chapterId)
    this.setData({ ready: true, personaId: this.personaId, chapter: view.current, number: view.number, chapterNumberText: PRODUCT_COPY.preview.chapterNumber.replace('{number}', String(view.number)), hasNext: view.hasNext })
  },

  openEvidence(event) {
    const dimensionId = event.currentTarget.dataset.dimensionId
    if (!dimensionId) return
    const query = this.mode === 'product-v0' ? `mode=product-v0&dimension=${encodeURIComponent(dimensionId)}` : `persona=${encodeURIComponent(this.personaId)}&dimension=${encodeURIComponent(dimensionId)}`
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result-evidence/index?${query}` })
  },

  continueNext() {
    if (this.mode === 'product-v0') {
      if (this.nextIndex !== undefined) return navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire-v3/index?index=${encodeURIComponent(this.nextIndex)}` })
      return navigateOnce(this, 'redirectTo', { url: '/pages/v3-result/index?mode=product-v0' })
    }
    const nextIndex = chapterIndex(this.chapterId) + 1
    const nextChapter = CHAPTERS[nextIndex]
    if (nextChapter) {
      navigateOnce(this, 'redirectTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.personaId)}&chapter=${nextChapter.id}` })
    } else {
      navigateOnce(this, 'redirectTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}` })
    }
  },

  openResult() {
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateTo', { url: '/pages/v3-result/index?mode=product-v0' })
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}` })
  },

  backToPreview() {
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire-v3/index' }) })
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  }
})

module.exports = { chapterIndex, chapterView, productChapterView }
