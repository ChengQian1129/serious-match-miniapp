const { FEATURES } = require('../../utils/features')
const store = require('../../utils/assessment-v3-product-v0/session-store')
const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const publicLanguage = require('../../shared/content/public-language.generated')
const cloud = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

const PRODUCT_V0_COPY = publicLanguage.v3.productV0
const CHAPTER_LABELS = Object.freeze(PRODUCT_V0_COPY.chapters || {})
const SECTION_KEYS = Object.freeze(runtime.BUNDLE.orderedParentTaskIds.reduce((keys, taskId) => {
  const task = runtime.getTask(taskId)
  const key = task && task.freezeMeta && (task.freezeMeta.chapter || task.freezeMeta.part)
  return key && !keys.includes(key) ? keys.concat(key) : keys
}, []))

function chapterIndex(chapter) { return ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].indexOf(chapter) }
function hasOwn(value, key) { return Object.prototype.hasOwnProperty.call(value || {}, key) }
function sameValue(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function sectionPosition(task) {
  const key = task && task.freezeMeta && (task.freezeMeta.chapter || task.freezeMeta.part)
  const index = SECTION_KEYS.indexOf(key)
  return { number: index >= 0 ? index + 1 : 1, total: SECTION_KEYS.length }
}
function progressLabel(number, total) {
  return PRODUCT_V0_COPY.progressTemplate.replace('{number}', String(number)).replace('{total}', String(total))
}

function progressPercentLabel(ratio) {
  if (ratio > 0 && ratio < 0.01) return '<1%'
  return `${Math.round(ratio * 100)}%`
}

function progressWidth(ratio) {
  return `${Math.min(100, Math.max(0, ratio * 100))}%`
}

function sessionRevision(session) {
  return [
    Number(session && session.updatedAt) || 0,
    Number(session && session.currentTaskIndex) || 0,
    Array.isArray(session && session.answerEvents) ? session.answerEvents.length : 0,
    Array.isArray(session && session.taskEvents) ? session.taskEvents.length : 0,
    session && session.completedAt || null,
    session && session.status || ''
  ].join('|')
}

function isFirstTask(taskId) {
  return runtime.BUNDLE.orderedParentTaskIds.indexOf(taskId) === 0
}

function buildItems(task, session, pendingInputs = {}) {
  const answers = session.latestAnswers || session.answers || {}
  return runtime.itemEntries(task).map(entry => {
    const hasPending = hasOwn(pendingInputs, entry.itemId)
    const value = hasPending ? pendingInputs[entry.itemId] : answers[entry.itemId]
    const format = runtime.resolvePublicFormat(entry.item.response, entry.itemId, task.taskId)
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

function entryIsComplete(entry, answers, missingness) {
  if (hasOwn(missingness, entry.itemId)) return true
  if (!hasOwn(answers, entry.itemId)) return false
  return runtime.isAccounted(entry.itemId, answers, missingness) && runtime.validateValue(entry, answers[entry.itemId]).ok
}

function pageState(session, pendingInputs = {}) {
  const taskId = store.currentTaskId(session)
  const task = taskId ? runtime.publicTask(taskId) : null
  if (!task) return { taskId: '', task: null, items: [], chapter: '', chapterLabel: '', chapterNumber: 0, sectionNumber: SECTION_KEYS.length, sectionCount: SECTION_KEYS.length, progress: 1, progressLabel: progressLabel(SECTION_KEYS.length, SECTION_KEYS.length), progressPercentLabel: '100%', progressWidth: '100%', isFirstTask: false, showIntro: false, isDecisionPart: false, canContinue: false, continueLabel: PRODUCT_V0_COPY.resultAction }
  const chapter = task.freezeMeta && task.freezeMeta.chapter
  const part = task.freezeMeta && task.freezeMeta.part
  const section = sectionPosition(task)
  const answers = Object.assign({}, session.latestAnswers || session.answers || {}, pendingInputs)
  const missingness = Object.assign({}, session.missingness || {})
  Object.keys(pendingInputs).forEach(itemId => { delete missingness[itemId] })
  const ratio = runtime.progress(session).ratio
  return {
    taskId,
    task: { prompt: task.prompt || '' },
    items: buildItems(task, session, pendingInputs),
    chapter: chapter || '',
    chapterLabel: chapter ? CHAPTER_LABELS[chapter] : ((PRODUCT_V0_COPY.partLabels || {})[part] || ''),
    chapterNumber: chapter ? chapterIndex(chapter) + 1 : 7,
    sectionNumber: section.number,
    sectionCount: section.total,
    progress: ratio,
    progressLabel: progressLabel(section.number, section.total),
    progressPercentLabel: progressPercentLabel(ratio),
    progressWidth: progressWidth(ratio),
    isFirstTask: isFirstTask(taskId),
    showIntro: isFirstTask(taskId),
    continueLabel: taskId ? PRODUCT_V0_COPY.continueAction : PRODUCT_V0_COPY.resultAction,
    isDecisionPart: !chapter,
    canContinue: runtime.itemEntries(task).every(entry => entryIsComplete(entry, answers, missingness))
  }
}

Page({
  data: { ready: false, copy: PRODUCT_V0_COPY, task: null, items: [], taskId: '', chapter: '', chapterLabel: '', chapterNumber: 1, sectionNumber: 1, sectionCount: SECTION_KEYS.length, progress: 0, progressLabel: progressLabel(1, SECTION_KEYS.length), progressPercentLabel: '0%', progressWidth: '0%', isFirstTask: false, showIntro: false, isDecisionPart: false, continueLabel: PRODUCT_V0_COPY.continueAction, motionClass: '', syncing: false, syncError: '' },

  onLoad(options = {}) {
    if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.pendingInputs = {}
    let session = store.getSession()
    if (options.index !== undefined) session = store.setTaskIndex(Number(options.index))
    if (!session.startedAt) session = store.saveSession(store.emptySession())
    this.session = session
    this.setData(Object.assign({ ready: true }, pageState(session, this.pendingInputs)))
  },

  onShow() { resetNavigation(this); if (this.data.ready) { this.refresh(); this.syncPending() } },
  onHide() { if (this.commitPendingInputs()) this.syncPending() },

  refresh() {
    this.session = store.getSession()
    this.setData(pageState(this.session, this.pendingInputs))
  },

  commitPendingInputs(itemId) {
    const pending = this.pendingInputs || {}
    const ids = itemId ? [itemId] : Object.keys(pending)
    for (const currentItemId of ids) {
      if (!hasOwn(pending, currentItemId)) continue
      const value = pending[currentItemId]
      const entry = runtime.getEntry(currentItemId)
      const format = entry && runtime.resolveFormat(entry.item.response)
      const session = store.getSession()
      const storedAnswers = session.latestAnswers || session.answers || {}
      if (value === undefined || value === null || value === '') {
        if (format && (format.allowBlank || format.type === 'free_text')) {
          if (hasOwn(storedAnswers, currentItemId) || hasOwn(session.missingness, currentItemId)) store.markMissing(currentItemId, 'NOT_SURE')
          delete pending[currentItemId]
          continue
        }
        return false
      }
      if (!entry || !runtime.validateValue(entry, value).ok) {
        wx.showToast({ title: PRODUCT_V0_COPY.errors.saveFailed, icon: 'none' })
        return false
      }
      const stored = storedAnswers[currentItemId]
      if (!sameValue(stored, value) || hasOwn(session.missingness, currentItemId)) store.answerItem(currentItemId, value)
      delete pending[currentItemId]
    }
    this.session = store.getSession()
    return true
  },

  chooseAnswer(event) {
    const itemId = event.currentTarget.dataset.itemId
    const value = event.currentTarget.dataset.value
    const item = this.data.items.find(candidate => candidate.itemId === itemId)
    if (!item) return
    delete (this.pendingInputs || {})[itemId]
    if (item.type === 'multi_select') {
      const selected = item.selectedValues.slice()
      const index = selected.findIndex(candidate => String(candidate) === String(value))
      if (index >= 0) selected.splice(index, 1)
      else selected.push(String(value))
      try { this.session = store.answerItem(itemId, selected); this.refresh(); this.syncPending() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.incompleteSelection, icon: 'none' }) }
      return
    }
    try { this.session = store.answerItem(itemId, value); this.refresh(); this.syncPending() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.saveFailed, icon: 'none' }) }
  },

  handleInput(event) {
    const itemId = event.currentTarget.dataset.itemId
    if (!this.pendingInputs) this.pendingInputs = {}
    this.pendingInputs[itemId] = event.detail.value
    const itemIndex = this.data.items.findIndex(item => item.itemId === itemId)
    const state = pageState(store.getSession(), this.pendingInputs)
    if (itemIndex < 0) return this.setData({ canContinue: state.canContinue })
    this.setData({ [`items[${itemIndex}].value`]: event.detail.value, canContinue: state.canContinue })
  },

  handleInputBlur(event) {
    this.commitPendingInputs(event.currentTarget.dataset.itemId)
    this.refresh()
  },

  skipItem(event) {
    const itemId = event.currentTarget.dataset.itemId
    delete (this.pendingInputs || {})[itemId]
    try { this.session = store.markMissing(itemId, 'NOT_SURE'); this.refresh(); this.syncPending() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.cannotSkip, icon: 'none' }) }
  },

  handleBack() {
    if (!this.commitPendingInputs()) return
    this.syncPending()
    const session = store.getSession()
    if (session.currentTaskIndex <= 0) return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) })
    this.session = store.goPrevious()
    this.setData(Object.assign({ motionClass: 'motion-back' }, pageState(this.session, this.pendingInputs)))
    this.syncPending()
  },

  handleContinue() {
    if (this._isRouting || !this.commitPendingInputs()) return
    this.refresh()
    if (!this.data.canContinue) return wx.showToast({ title: PRODUCT_V0_COPY.errors.incomplete, icon: 'none' })
    const before = store.getSession(); const currentTask = runtime.getTask(store.currentTaskId(before)); const currentChapter = currentTask && currentTask.freezeMeta && currentTask.freezeMeta.chapter
    try {
      const next = store.goNext()
      const nextTask = runtime.getTask(store.currentTaskId(next)); const nextChapter = nextTask && nextTask.freezeMeta && nextTask.freezeMeta.chapter
      if (next.status === 'completed' && next.completedAt) {
        this.syncPending()
        return navigateOnce(this, 'redirectTo', { url: '/pages/v3-result/index?mode=product-v0' })
      }
      const crossedChapter = currentChapter && nextChapter && currentChapter !== nextChapter
      const leftCore = currentChapter === 'C6' && !nextChapter
      this.syncPending()
      if (crossedChapter || leftCore) return navigateOnce(this, 'redirectTo', { url: `/pages/v3-checkpoint/index?mode=product-v0&chapter=${encodeURIComponent(currentChapter)}&nextIndex=${next.currentTaskIndex}` })
      if (!nextTask) return navigateOnce(this, 'redirectTo', { url: '/pages/v3-result/index?mode=product-v0' })
      this.session = next
      this.setData(Object.assign({ motionClass: 'motion-forward' }, pageState(next, this.pendingInputs)))
    } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.incomplete, icon: 'none' }) }
  },

  syncPending() {
    if (this._cloudSyncing || !cloud.isCloudReady()) return
    const session = store.getSession()
    if (!store.hasSession() || !session.answerEvents.length) return
    this._cloudSyncing = true
    const requestedRevision = sessionRevision(session)
    this.setData({ syncing: true, syncError: '' })
    const success = data => {
      const current = store.getSession()
      const returned = data && data.session
      const serverWon = Boolean(data && data.staleIgnored) || Number(returned && returned.clientUpdatedAt) > Number(current.updatedAt)
      const localChanged = sessionRevision(current) !== requestedRevision
      if (returned && serverWon) store.replaceSession(returned)
      if (data && data.report && (!localChanged || serverWon)) store.replaceReport(data.report)
      else if (!localChanged && !serverWon) store.markSynced(data && data.syncedAt)
      this._cloudSyncing = false
      if (localChanged && !serverWon) {
        this.setData({ syncing: false, syncError: '' })
        return this.syncPending()
      }
      this.setData({ syncing: false, syncError: '' })
      this.refresh()
    }
    const fail = error => {
      this._cloudSyncing = false
      this.setData({ syncing: false, syncError: cloud.cloudErrorMessage(error) })
    }
    const callbacks = { success, fail }
    if (session.status === 'completed') cloud.completeProductV0ToCloud(session, callbacks)
    else cloud.saveProductV0DraftToCloud(session, callbacks)
  }
})

module.exports = { chapterIndex, buildItems, pageState, progressLabel, progressPercentLabel, progressWidth, sectionPosition, isFirstTask, sessionRevision, PRODUCT_V0_COPY }
