const { FEATURES } = require('../../utils/features')
const { CHAPTERS } = require('../../shared/assessment-v3-product/contract')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildChapterView, PRODUCT_COPY, PRODUCT_V0_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')
const productJourney = require('../../utils/assessment-v3-product-v0/journey-model')
const { recordEvent } = require('../../utils/storage')

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

function sectionById(sectionId) {
  return productJourney.getSections().find(section => section.id === sectionId) || null
}

function checkpointLabel(section, progress, globalProgress) {
  const sectionText = `第 ${progress.sectionNumber} / ${progress.sectionCount} 部分`
  const taskText = `本部分 ${progress.completedTasks} / ${progress.totalTasks} 题`
  const completedText = `已完成 ${globalProgress.completedSections} / ${globalProgress.totalSections} 个部分`
  return `${sectionText} · ${taskText} · ${completedText}`
}

function transitionView(section, nextSection) {
  return {
    id: section.id,
    title: section.title,
    intro: section.description,
    headline: section.completedTitle || `${section.title}完成了`,
    summary: section.description,
    dimensionCards: [],
    transition: nextSection ? `接下来，我们进入“${nextSection.title}”。` : '这份结果还会随着你之后的回答继续变得清楚。'
  }
}

function productCheckpointView(sectionId, nextIndex) {
  const session = productStore.getSession()
  const sections = productJourney.getSections()
  const requested = sectionById(sectionId)
  const section = requested || productJourney.currentSection(session) || sections[0]
  const progress = productJourney.getSectionProgress(session, section.id)
  const globalProgress = productJourney.getGlobalProgress(session)
  const nextTaskId = nextIndex === undefined ? '' : productRuntime.BUNDLE.orderedParentTaskIds[Number(nextIndex)]
  const nextSection = nextTaskId ? productJourney.getSectionForTask(nextTaskId) : sections[progress.sectionNumber]
  const profile = session.derivedProfile || productRuntime.deriveProfile(session)
  const report = buildReport(profile)
  const current = section.id.startsWith('C') ? buildChapterView(report, section.id) : transitionView(section, nextSection)
  const resolvedCurrent = current || transitionView(section, nextSection)
  if (section.id === 'C6' && nextSection && section.remainingSectionsTemplate) {
    resolvedCurrent.transition = section.remainingSectionsTemplate.replace('{count}', String(Math.max(0, sections.length - progress.sectionNumber)))
  }
  return {
    report,
    current: resolvedCurrent,
    section,
    nextSection,
    progress,
    globalProgress,
    number: progress.sectionNumber,
    sectionCount: progress.sectionCount,
    progressWidth: `${Math.round(globalProgress.sectionRatio * 100)}%`,
    progressLabel: checkpointLabel(section, progress, globalProgress),
    hasDetails: Boolean(resolvedCurrent.dimensionCards && resolvedCurrent.dimensionCards.length),
    hasNext: Number.isInteger(nextIndex) && nextIndex >= 0 && Boolean(nextTaskId),
    isComplete: productJourney.isAssessmentComplete(session),
    isFinal: nextIndex === undefined && productJourney.isAssessmentComplete(session)
  }
}

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    chapter: null,
    number: 1,
    chapterNumberText: '',
    hasNext: false,
    personaId: '',
    mode: '',
    isProductMode: false,
    sectionProgressLabel: '',
    progressWidth: '0%',
    hasDetails: false,
    detailsExpanded: false,
    nextSectionLabel: '',
    isComplete: false,
    isFinal: false
  },

  onLoad(options = {}) {
    if (options.mode === 'product-v0') {
      if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      this.mode = 'product-v0'
      this.sectionId = options.section || options.chapter || ''
      this.nextIndex = options.nextIndex === undefined ? undefined : Number(options.nextIndex)
      this.setData({ copy: PRODUCT_V0_COPY })
      this.loadCheckpoint()
      return
    }
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.chapterId = options.chapter || 'C1'
    this.loadCheckpoint()
  },

  onShow() { resetNavigation(this) },

  loadCheckpoint() {
    if (this.mode === 'product-v0') {
      const view = productCheckpointView(this.sectionId, this.nextIndex)
      this.sectionId = view.section.id
      this.setData({
        ready: true,
        mode: this.mode,
        isProductMode: true,
        copy: PRODUCT_V0_COPY,
        chapter: view.current,
        number: view.number,
        sectionProgressLabel: view.progressLabel,
        chapterNumberText: view.progressLabel,
        progressWidth: view.progressWidth,
        hasNext: view.hasNext,
        hasDetails: view.hasDetails,
        detailsExpanded: false,
        nextSectionLabel: view.nextSection ? PRODUCT_V0_COPY.checkpoint.nextSectionTemplate.replace('{title}', view.nextSection.title) : '',
        isComplete: view.isComplete,
        isFinal: view.isFinal,
        personaId: ''
      })
      return
    }
    const view = chapterView(this.personaId, this.chapterId)
    this.setData({ ready: true, mode: '', isProductMode: false, personaId: this.personaId, chapter: view.current, number: view.number, chapterNumberText: PRODUCT_COPY.preview.chapterNumber.replace('{number}', String(view.number)), hasNext: view.hasNext, hasDetails: true, detailsExpanded: true, progressWidth: `${Math.round(view.number / CHAPTERS.length * 100)}%` })
  },

  toggleDetails() {
    if (!this.data.hasDetails) return
    this.setData({ detailsExpanded: !this.data.detailsExpanded })
  },

  openEvidence(event) {
    const dimensionId = event.currentTarget.dataset.dimensionId
    if (!dimensionId) return
    const query = this.mode === 'product-v0' ? `mode=product-v0&dimension=${encodeURIComponent(dimensionId)}` : `persona=${encodeURIComponent(this.personaId)}&dimension=${encodeURIComponent(dimensionId)}`
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result-evidence/index?${query}` })
  },

  continueNext() {
    if (this.mode === 'product-v0') {
      recordEvent('checkpoint_continue', { sectionId: this.sectionId, hasNext: this.nextIndex !== undefined })
      if (this.nextIndex !== undefined) return navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire-v3/index?index=${encodeURIComponent(this.nextIndex)}` })
      return navigateOnce(this, 'redirectTo', { url: `/pages/v3-result/index?mode=product-v0${this.data.isComplete ? '' : '&scope=partial'}` })
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
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateTo', { url: `/pages/v3-result/index?mode=product-v0${this.data.isComplete ? '' : '&scope=partial'}` })
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}` })
  },

  backToPreview() {
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) })
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  pause() {
    if (this.mode !== 'product-v0') return this.backToPreview()
    recordEvent('section_pause', { sectionId: this.sectionId })
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  }
})

module.exports = { chapterIndex, chapterView, productChapterView, productCheckpointView, checkpointLabel, transitionView }
