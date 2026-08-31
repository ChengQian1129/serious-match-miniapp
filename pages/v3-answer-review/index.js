const { FEATURES } = require('../../utils/features')
const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const store = require('../../utils/assessment-v3-product-v0/session-store')
const journey = require('../../utils/assessment-v3-product-v0/journey-model')
const publicLanguage = require('../../shared/content/public-language.generated')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')
const { resolveReturnContext, contextUrl, questionnaireEditUrl, parentResultUrl } = require('../../utils/assessment-v3-product-v0/return-context')

const COPY = publicLanguage.v3.productV0

function hasOwn(value, key) { return Object.prototype.hasOwnProperty.call(value || {}, key) }
function reviewAnchor(taskId) { return `review-task-${String(taskId || '').replace(/[^a-zA-Z0-9_-]/g, '-')}` }

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
    const answered = journey.canFinishEditing(session, entry.parent.taskId)
    return {
      itemId: entry.itemId,
      taskId: entry.parent.taskId,
      prompt: publicValue.prompt,
      answer: answerSummary(entry, session),
      isComplete: journey.isTaskComplete(session, entry.parent.taskId),
      hasAnswer: hasOwn(session.latestAnswers || session.answers || {}, entry.itemId) || hasOwn(session.missingness || {}, entry.itemId),
      answered,
      editable: answered
    }
  }))
}

function buildReviewSections(session, activeSectionId) {
  let firstAnsweredSectionId = ''
  const sections = journey.getSections(COPY).map(section => {
    const progress = journey.getSectionProgress(session, section.id, COPY)
    const items = reviewItems(section, session)
    const hasAnsweredItems = items.some(item => item.answered)
    if (!firstAnsweredSectionId && hasAnsweredItems) firstAnsweredSectionId = section.id
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      sectionNumber: progress.sectionNumber,
      sectionCount: progress.sectionCount,
      progressText: `${progress.completedTasks} / ${progress.totalTasks}`,
      isComplete: progress.isComplete,
      status: progress.isComplete ? 'complete' : progress.completedTasks ? 'in_progress' : 'locked',
      expanded: false,
      hasAnsweredItems,
      items
    }
  })
  return sections.map(section => Object.assign({}, section, {
    expanded: section.hasAnsweredItems && (section.id === activeSectionId || (!activeSectionId && section.id === firstAnsweredSectionId))
  }))
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
    this.returnContext = resolveReturnContext(options, { source: 'result' })
    this.returnTo = contextUrl(this.returnContext)
    this.setData({ returnTo: this.returnTo, copy: COPY })
    this.loadReview()
  },

  onShow() { resetNavigation(this); if (this.data.ready) this.loadReview() },

  loadReview() {
    const session = store.getSession()
    const global = journey.getGlobalProgress(session, COPY)
    const sections = buildReviewSections(session, this.activeSectionId)
    const isComplete = Boolean(session.completedAt && journey.isAssessmentComplete(session, COPY))
    this.returnTo = parentResultUrl(this.returnContext || { source: 'result' }, !isComplete)
    if (!session.answerEvents.length && !session.completedAt) {
      this.setData({ ready: true, emptyState: true, returnTo: this.returnTo, sections: [], completedSectionsLabel: `已完成 ${global.completedSections} / ${global.totalSections} 个部分` })
      return
    }
    this.setData({ ready: true, emptyState: false, returnTo: this.returnTo, sections, completedSectionsLabel: `已完成 ${global.completedSections} / ${global.totalSections} 个部分` })
    this.restoreReturnAnchor()
    if (!this._reviewViewed) {
      this._reviewViewed = true
      recordEvent('answer_review_view', { completedSections: global.completedSections, totalSections: global.totalSections, isComplete })
    }
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
    const session = store.getSession()
    if (!journey.canFinishEditing(session, taskId)) {
      const message = (COPY.preview && COPY.preview.answerReviewUnavailable) || (COPY.questionnaire && COPY.questionnaire.editUnavailable) || '这道题还没有回答'
      recordEvent('questionnaire_edit_guard', { taskId, reason: 'not_answered' })
      if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') wx.showToast({ title: message, icon: 'none' })
      return false
    }
    const section = journey.getSectionForTask(taskId, COPY)
    const context = { source: 'answer-review', targetId: this.activeSectionId || section && section.id || '', scrollAnchor: reviewAnchor(taskId), reportVersion: Number(session.reportRevision) || 0 }
    recordEvent('answer_edit_open', { taskId, sectionId: section && section.id || '' })
    return navigateOnce(this, 'navigateTo', { url: questionnaireEditUrl(taskId, context) })
  },

  restoreReturnAnchor() {
    if (this._returnAnchorRestored || !this.returnContext || !this.returnContext.scrollAnchor) return
    if (typeof wx === 'undefined' || typeof wx.pageScrollTo !== 'function') return
    this._returnAnchorRestored = true
    const scroll = () => wx.pageScrollTo({ selector: `#${this.returnContext.scrollAnchor}`, offsetTop: -24, duration: 0 })
    if (typeof wx.nextTick === 'function') wx.nextTick(scroll)
    else scroll()
  },

  back() {
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: this.returnTo || '/pages/v3-result/index?mode=product-v0' }) })
  },

  goHome() { navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) }
})

module.exports = { publicEntry, answerSummary, reviewItems, buildReviewSections }
