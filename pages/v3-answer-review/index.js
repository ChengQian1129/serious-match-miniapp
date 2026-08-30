const { FEATURES } = require('../../utils/features')
const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const store = require('../../utils/assessment-v3-product-v0/session-store')
const journey = require('../../utils/assessment-v3-product-v0/journey-model')
const publicLanguage = require('../../shared/content/public-language.generated')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')

const COPY = publicLanguage.v3.productV0

function hasOwn(value, key) { return Object.prototype.hasOwnProperty.call(value || {}, key) }

function publicEntry(entry) {
  const task = runtime.publicTask(entry.parent.taskId)
  const item = entry.itemId === entry.parent.taskId
    ? task
    : (task && Array.isArray(task.children) ? task.children.find(child => child.itemId === entry.itemId) : null)
  return { task, item, prompt: item && item.prompt || entry.item.prompt || entry.parent.prompt || '' }
}

function answerSummary(entry, session) {
  const answers = session.latestAnswers || session.answers || {}
  const missingness = session.missingness || {}
  if (hasOwn(missingness, entry.itemId)) return COPY.skipAction
  if (!hasOwn(answers, entry.itemId)) return '未回答'
  const value = answers[entry.itemId]
  const format = runtime.resolvePublicFormat(entry.item.response, entry.itemId, entry.parent.taskId)
  if (format && (format.type === 'number' || format.type === 'free_text')) return String(value)
  return runtime.optionLabel(entry, value) || '已回答'
}

function reviewItems(section, session) {
  return section.taskIds.flatMap(taskId => runtime.itemEntries(runtime.getTask(taskId)).map(entry => {
    const publicValue = publicEntry(entry)
    return {
      itemId: entry.itemId,
      taskId: entry.parent.taskId,
      prompt: publicValue.prompt,
      answer: answerSummary(entry, session),
      isComplete: journey.isTaskComplete(session, entry.parent.taskId),
      hasAnswer: hasOwn(session.latestAnswers || session.answers || {}, entry.itemId) || hasOwn(session.missingness || {}, entry.itemId)
    }
  }))
}

function buildReviewSections(session, activeSectionId) {
  const firstIncomplete = journey.getNextIncompleteSection(session)
  return journey.getSections(COPY).map(section => {
    const progress = journey.getSectionProgress(session, section.id, COPY)
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      sectionNumber: progress.sectionNumber,
      sectionCount: progress.sectionCount,
      progressText: `${progress.completedTasks} / ${progress.totalTasks}`,
      isComplete: progress.isComplete,
      status: progress.isComplete ? 'complete' : progress.completedTasks ? 'in_progress' : 'locked',
      expanded: section.id === activeSectionId || (!activeSectionId && firstIncomplete && section.id === firstIncomplete.id),
      items: reviewItems(section, session)
    }
  })
}

Page({
  data: {
    ready: false,
    emptyState: false,
    copy: COPY,
    sections: [],
    completedSectionsLabel: '',
    returnTo: ''
  },

  onLoad(options = {}) {
    if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.activeSectionId = options.section || ''
    try { this.returnTo = options.returnTo ? decodeURIComponent(String(options.returnTo)) : '/pages/v3-result/index?mode=product-v0' } catch (error) { this.returnTo = '/pages/v3-result/index?mode=product-v0' }
    this.setData({ returnTo: this.returnTo, copy: COPY })
    this.loadReview()
  },

  onShow() { resetNavigation(this); if (this.data.ready) this.loadReview() },

  loadReview() {
    const session = store.getSession()
    const global = journey.getGlobalProgress(session, COPY)
    const sections = buildReviewSections(session, this.activeSectionId)
    if (!session.answerEvents.length && !session.completedAt) {
      this.setData({ ready: true, emptyState: true, sections: [], completedSectionsLabel: `已完成 ${global.completedSections} / ${global.totalSections} 个部分` })
      return
    }
    this.setData({ ready: true, emptyState: false, sections, completedSectionsLabel: `已完成 ${global.completedSections} / ${global.totalSections} 个部分` })
  },

  toggleSection(event) {
    const sectionId = event.currentTarget.dataset.sectionId
    if (!sectionId) return
    const sections = this.data.sections.map(section => section.id === sectionId ? Object.assign({}, section, { expanded: !section.expanded }) : section)
    this.setData({ sections })
  },

  editItem(event) {
    const taskId = event.currentTarget.dataset.taskId
    if (!taskId) return
    recordEvent('answer_edit_open', { taskId })
    const returnTo = this.returnTo || '/pages/v3-result/index?mode=product-v0'
    navigateOnce(this, 'navigateTo', { url: `/pages/questionnaire-v3/index?taskId=${encodeURIComponent(taskId)}&returnTo=${encodeURIComponent(returnTo)}` })
  },

  back() {
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: this.returnTo || '/pages/v3-result/index?mode=product-v0' }) })
  },

  goHome() { navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) }
})

module.exports = { publicEntry, answerSummary, reviewItems, buildReviewSections }
