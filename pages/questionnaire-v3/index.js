const { FEATURES } = require('../../utils/features')
const store = require('../../utils/assessment-v3-product-v0/session-store')
const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const publicLanguage = require('../../shared/content/public-language.generated')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

const PRODUCT_V0_COPY = publicLanguage.v3.productV0
const CHAPTER_LABELS = Object.freeze(PRODUCT_V0_COPY.chapters || {})

function chapterIndex(chapter) { return ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].indexOf(chapter) }
function buildItems(task, session) {
  return runtime.itemEntries(task).map(entry => {
    const format = runtime.resolveFormat(entry.item.response)
    const value = (session.latestAnswers || session.answers || {})[entry.itemId]
    const selectedValues = Array.isArray(value) ? value.slice() : []
    return {
      itemId: entry.itemId,
      prompt: entry.item.prompt || task.prompt || '',
      type: format && format.type,
      options: (format && format.options || []).map(option => Object.assign({}, option, {
        selected: Array.isArray(value) ? selectedValues.some(candidate => String(candidate) === String(option.code)) : value !== undefined && value !== '' && String(value) === String(option.code)
      })),
      value: value === undefined ? '' : value,
      selectedValues,
      selectedMark: value !== undefined && value !== '' ? PRODUCT_V0_COPY.selectedMark : PRODUCT_V0_COPY.unselectedMark,
      canSkip: Boolean(format && (format.allowBlank || format.type === 'free_text'))
    }
  })
}
function pageState(session) {
  const taskId = store.currentTaskId(session)
  const task = taskId ? runtime.publicTask(taskId) : null
  if (!task) return { taskId: '', task: null, items: [], chapter: '', chapterLabel: '', chapterNumber: 0, progress: 1, progressLabel: PRODUCT_V0_COPY.progressTemplate.replace('{number}', '9'), progressPercentLabel: '100%', isDecisionPart: false, canContinue: false, continueLabel: PRODUCT_V0_COPY.resultAction }
  const chapter = task.freezeMeta && task.freezeMeta.chapter
  const part = task.freezeMeta && task.freezeMeta.part
  return {
    taskId,
    task: { prompt: task.prompt || '' },
    items: buildItems(task, session),
    chapter: chapter || '',
    chapterLabel: chapter ? CHAPTER_LABELS[chapter] : ((PRODUCT_V0_COPY.partLabels || {})[part] || ''),
    chapterNumber: chapter ? chapterIndex(chapter) + 1 : 7,
    progress: runtime.progress(session).ratio,
    progressLabel: PRODUCT_V0_COPY.progressTemplate.replace('{number}', String(chapter ? chapterIndex(chapter) + 1 : 7)),
    progressPercentLabel: `${Math.round(runtime.progress(session).ratio * 100)}%`,
    continueLabel: taskId ? PRODUCT_V0_COPY.continueAction : PRODUCT_V0_COPY.resultAction,
    isDecisionPart: !chapter,
    canContinue: runtime.itemEntries(task).every(entry => runtime.isAccounted(entry.itemId, session.latestAnswers || {}, session.missingness || {}))
  }
}

Page({
  data: { ready: false, copy: PRODUCT_V0_COPY, task: null, items: [], taskId: '', chapter: '', chapterLabel: '', chapterNumber: 1, progress: 0, progressLabel: PRODUCT_V0_COPY.progressTemplate.replace('{number}', '1'), progressPercentLabel: '0%', isDecisionPart: false, continueLabel: PRODUCT_V0_COPY.continueAction, motionClass: '' },

  onLoad(options = {}) {
    if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    let session = store.getSession()
    if (options.index !== undefined) session = store.setTaskIndex(Number(options.index))
    if (!session.startedAt) session = store.saveSession(store.emptySession())
    this.session = session
    this.setData(Object.assign({ ready: true }, pageState(session)))
  },

  onShow() { resetNavigation(this); if (this.data.ready) this.refresh() },

  refresh() {
    this.session = store.getSession()
    this.setData(pageState(this.session))
  },

  chooseAnswer(event) {
    const itemId = event.currentTarget.dataset.itemId
    const value = event.currentTarget.dataset.value
    const item = this.data.items.find(candidate => candidate.itemId === itemId)
    if (!item) return
    if (item.type === 'multi_select') {
      const selected = item.selectedValues.slice()
      const index = selected.findIndex(candidate => String(candidate) === String(value))
      if (index >= 0) selected.splice(index, 1)
      else selected.push(String(value))
      try { this.session = store.answerItem(itemId, selected); this.refresh() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.incompleteSelection, icon: 'none' }) }
      return
    }
    try { this.session = store.answerItem(itemId, value); this.refresh() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.saveFailed, icon: 'none' }) }
  },

  handleInput(event) {
    const itemId = event.currentTarget.dataset.itemId
    const value = event.detail.value
    try { this.session = store.answerItem(itemId, value); this.refresh() } catch (error) { /* validation waits until continue */ }
  },

  skipItem(event) {
    const itemId = event.currentTarget.dataset.itemId
    try { this.session = store.markMissing(itemId, 'NOT_SURE'); this.refresh() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.cannotSkip, icon: 'none' }) }
  },

  handleBack() {
    const session = store.getSession()
    if (session.currentTaskIndex <= 0) return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) })
    this.session = store.goPrevious(); this.setData(Object.assign({ motionClass: 'motion-back' }, pageState(this.session)))
  },

  handleContinue() {
    if (this._isRouting || !this.data.canContinue) return
    const before = store.getSession(); const currentTask = runtime.getTask(store.currentTaskId(before)); const currentChapter = currentTask && currentTask.freezeMeta && currentTask.freezeMeta.chapter
    try {
      const next = store.goNext()
      const nextTask = runtime.getTask(store.currentTaskId(next)); const nextChapter = nextTask && nextTask.freezeMeta && nextTask.freezeMeta.chapter
      const crossedChapter = currentChapter && nextChapter && currentChapter !== nextChapter
      const leftCore = currentChapter === 'C6' && !nextChapter
      if (crossedChapter || leftCore) {
        return navigateOnce(this, 'redirectTo', { url: `/pages/v3-checkpoint/index?mode=product-v0&chapter=${encodeURIComponent(currentChapter)}&nextIndex=${next.currentTaskIndex}` })
      }
      if (!nextTask) return navigateOnce(this, 'redirectTo', { url: '/pages/v3-result/index?mode=product-v0' })
      this.session = next; this.setData(Object.assign({ motionClass: 'motion-forward' }, pageState(next)))
    } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.incomplete, icon: 'none' }) }
  }
})

module.exports = { chapterIndex, buildItems, pageState, PRODUCT_V0_COPY }
