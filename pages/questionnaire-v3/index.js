const { FEATURES } = require('../../utils/features')
const store = require('../../utils/assessment-v3-product-v0/session-store')
const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const publicLanguage = require('../../shared/content/public-language.generated')
const cloud = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent, hasSeenProductTrust, markProductTrustSeen } = require('../../utils/storage')
const journey = require('../../utils/assessment-v3-product-v0/journey-model')
const { resolveReturnContext, contextUrl } = require('../../utils/assessment-v3-product-v0/return-context')

const PRODUCT_V0_COPY = publicLanguage.v3.productV0
const CHAPTER_LABELS = Object.freeze(PRODUCT_V0_COPY.chapters || {})

function chapterIndex(chapter) { return ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].indexOf(chapter) }
function hasOwn(value, key) { return Object.prototype.hasOwnProperty.call(value || {}, key) }
function sameValue(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function sectionPosition(task) {
  const section = task && journey.getSectionForTask(task.taskId)
  const index = section ? journey.getSectionIndexForTask(task.taskId) : 0
  return { number: index >= 0 ? index + 1 : 1, total: journey.getSections().length, section }
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

function itemAnchor(itemId) { return `product-v0-item-${String(itemId || '').replace(/[^a-zA-Z0-9_-]/g, '-')}` }

function sectionIdForTask(taskId) {
  const section = journey.getSectionForTask(taskId)
  return section && section.id || ''
}

function syncLabel(state) {
  const copy = PRODUCT_V0_COPY.questionnaire || {}
  if (state === 'CLOUD_SYNCING') return copy.syncingLabel || PRODUCT_V0_COPY.syncingLabel
  if (state === 'SYNCED') return copy.syncedLabel || '已保存'
  if (state === 'CLOUD_FAILED') return copy.syncFailedLabel || '已保存在本机，同步失败 · 重试'
  if (state === 'LOCAL_SAVED') return copy.localSavedLabel || '已保存在本机'
  return ''
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
      canSkip: Boolean(format && (format.allowBlank || format.type === 'free_text')),
      anchorId: itemAnchor(entry.itemId),
      isMultiSelect: Boolean(format && format.type === 'multi_select')
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
  const sectionCount = journey.getSections().length
  const questionnaireCopy = PRODUCT_V0_COPY.questionnaire || {}
  if (!task) return { taskId: '', task: null, items: [], chapter: '', chapterLabel: '', chapterNumber: 0, sectionNumber: sectionCount, sectionCount, progress: 1, progressLabel: progressLabel(sectionCount, sectionCount), sectionProgressLabel: '', progressPercentLabel: '100%', progressWidth: '100%', isFirstTask: false, showIntro: false, isDecisionPart: false, canContinue: false, continueLabel: PRODUCT_V0_COPY.resultAction, backLabel: questionnaireCopy.previousAction || PRODUCT_V0_COPY.backAction, globalComplete: journey.isAssessmentComplete(session), hasMultiSelect: false }
  const chapter = task.freezeMeta && task.freezeMeta.chapter
  const part = task.freezeMeta && task.freezeMeta.part
  const section = sectionPosition(task)
  const answers = Object.assign({}, session.latestAnswers || session.answers || {}, pendingInputs)
  const missingness = Object.assign({}, session.missingness || {})
  Object.keys(pendingInputs).forEach(itemId => { delete missingness[itemId] })
  const ratio = runtime.progress(session).ratio
  const sectionProgress = journey.getSectionProgress(session, section.section && section.section.id)
  const sectionProgressLabel = (questionnaireCopy.sectionProgressTemplate || '本部分 {completed} / {total}')
    .replace('{completed}', String(sectionProgress.completedTasks))
    .replace('{total}', String(sectionProgress.totalTasks))
  return {
    taskId,
    task: { prompt: task.prompt || '' },
    items: buildItems(task, session, pendingInputs),
    chapter: chapter || '',
    chapterLabel: section.section && section.section.title || (chapter ? CHAPTER_LABELS[chapter] : ((PRODUCT_V0_COPY.partLabels || {})[part] || '')),
    chapterNumber: chapter ? chapterIndex(chapter) + 1 : 7,
    sectionNumber: section.number,
    sectionCount: section.total,
    sectionProgressLabel,
    progress: ratio,
    progressLabel: progressLabel(section.number, section.total),
    progressPercentLabel: progressPercentLabel(ratio),
    progressWidth: progressWidth(ratio),
    isFirstTask: isFirstTask(taskId),
    showIntro: isFirstTask(taskId),
    continueLabel: taskId ? PRODUCT_V0_COPY.continueAction : PRODUCT_V0_COPY.resultAction,
    isDecisionPart: !chapter,
    backLabel: isFirstTask(taskId) ? (questionnaireCopy.firstBackAction || '退出') : (questionnaireCopy.previousAction || PRODUCT_V0_COPY.backAction),
    canContinue: runtime.itemEntries(task).every(entry => entryIsComplete(entry, answers, missingness)),
    globalComplete: journey.isAssessmentComplete(session),
    hasMultiSelect: runtime.itemEntries(task).some(entry => { const format = runtime.resolveFormat(entry.item.response); return format && format.type === 'multi_select' })
  }
}

Page({
  data: { ready: false, copy: PRODUCT_V0_COPY, task: null, items: [], taskId: '', chapter: '', chapterLabel: '', chapterNumber: 1, sectionNumber: 1, sectionCount: journey.getSections().length, sectionProgressLabel: '', progress: 0, progressLabel: progressLabel(1, journey.getSections().length), progressPercentLabel: '0%', progressWidth: '0%', isFirstTask: false, showIntro: false, isDecisionPart: false, continueLabel: PRODUCT_V0_COPY.continueAction, backLabel: PRODUCT_V0_COPY.questionnaire && PRODUCT_V0_COPY.questionnaire.firstBackAction || '退出', hasMultiSelect: false, globalComplete: false, motionClass: '', syncing: false, syncError: '', syncState: '', syncStatusLabel: '', validationMessage: '', invalidItemId: '', editing: false, showTrustNote: false },

  onLoad(options = {}) {
    if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.pendingInputs = {}
    this.returnContext = resolveReturnContext(options, { source: 'result' })
    this.returnTo = contextUrl(this.returnContext)
    this.editTaskId = options.mode === 'edit' ? String(options.taskId || '') : ''
    this.editing = Boolean(this.editTaskId)
    let session = store.getSession()
    this.resumeTaskIndex = session.currentTaskIndex
    this.wasAssessmentComplete = Boolean(session.completedAt && journey.isAssessmentComplete(session))
    const invalidTaskMessage = (PRODUCT_V0_COPY.questionnaire && PRODUCT_V0_COPY.questionnaire.invalidTask) || '暂时没能加载这道题'
    if ((options.mode === 'edit' && !this.editing) || (options.taskId && !this.editing)) {
      return this.rejectRoute(invalidTaskMessage)
    }
    if (this.editing) {
      if (!journey.canFinishEditing(session, this.editTaskId)) return this.rejectEdit()
      const positioned = store.setTaskId(this.editTaskId)
      if (!positioned) {
        return this.rejectRoute(invalidTaskMessage)
      }
      session = positioned
    } else if (options.index !== undefined) {
      const requestedIndex = Number(options.index)
      if (Number.isInteger(requestedIndex) && requestedIndex === Number(session.currentTaskIndex)) session = store.setTaskIndex(requestedIndex)
      else if (Number.isInteger(requestedIndex) && requestedIndex !== Number(session.currentTaskIndex)) recordEvent('questionnaire_route_guard', { requestedIndex, currentTaskIndex: Number(session.currentTaskIndex) || 0 })
    }
    if (!session.startedAt) session = store.saveSession(store.emptySession())
    this.session = session
    this._sectionStartedAt = Date.now()
    const currentTaskId = store.currentTaskId(session)
    const showTrustNote = !this.editing && isFirstTask(currentTaskId) && !hasSeenProductTrust()
    if (showTrustNote) markProductTrustSeen()
    if (!this.editing && !session.answerEvents.length && Number(session.currentTaskIndex) === 0) recordEvent('assessment_start', { source: 'questionnaire' })
    if (this.editing) recordEvent('answer_edit_start', { taskId: currentTaskId, sectionId: sectionIdForTask(currentTaskId), taskIndex: Number(session.currentTaskIndex) || 0 })
    const initialSyncState = session.status === 'pending_cloud' ? 'LOCAL_SAVED' : (session.answerEvents.length ? 'SYNCED' : '')
    this.setData(Object.assign({ ready: true, editing: this.editing, showTrustNote, syncState: initialSyncState, syncStatusLabel: syncLabel(initialSyncState) }, pageState(session, this.pendingInputs)))
    recordEvent('section_start', { sectionId: sectionIdForTask(currentTaskId), sectionIndex: pageState(session, this.pendingInputs).sectionNumber, taskId: currentTaskId, taskIndex: Number(session.currentTaskIndex) || 0, sectionEnterAt: this._sectionStartedAt })
  },

  rejectRoute(message) {
    this.setData({ ready: true, invalidRoute: true, validationMessage: message })
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') wx.showToast({ title: message, icon: 'none' })
    const url = contextUrl(this.returnContext || { source: 'result' })
    return navigateOnce(this, 'redirectTo', { url, fail: () => navigateOnce(this, 'reLaunch', { url }) })
  },

  rejectEdit() {
    const questionnaireCopy = PRODUCT_V0_COPY.questionnaire || {}
    const message = questionnaireCopy.editUnavailable || questionnaireCopy.invalidTask || '这道题还没有回答'
    recordEvent('questionnaire_edit_guard', { taskId: this.editTaskId || '', reason: 'not_answered' })
    return this.rejectRoute(message)
  },

  onShow() { resetNavigation(this); if (this.data.ready) { this.refresh(); this.syncPending() } },
  onHide() { if (this.commitPendingInputs()) this.syncPending() },

  refresh() {
    this.session = store.getSession()
    this.setData(Object.assign({}, pageState(this.session, this.pendingInputs), { syncStatusLabel: syncLabel(this.data.syncState) }))
  },

  markLocalSaved() {
    this.setData({ syncState: 'LOCAL_SAVED', syncStatusLabel: syncLabel('LOCAL_SAVED'), syncError: '' })
  },

  incompleteItem() {
    const session = store.getSession()
    const task = runtime.getTask(store.currentTaskId(session))
    if (!task) return null
    const answers = Object.assign({}, session.latestAnswers || session.answers || {}, this.pendingInputs || {})
    const missingness = Object.assign({}, session.missingness || {})
    Object.keys(this.pendingInputs || {}).forEach(itemId => { delete missingness[itemId] })
    return runtime.itemEntries(task).find(entry => !entryIsComplete(entry, answers, missingness)) || null
  },

  showIncomplete() {
    const entry = this.incompleteItem()
    if (!entry) return false
    const questionnaireCopy = PRODUCT_V0_COPY.questionnaire || {}
    const detail = runtime.itemEntries(runtime.getTask(entry.parent.taskId)).length > 1 ? `${questionnaireCopy.incompleteField || '这里还需要完成'}：${entry.item.prompt || entry.parent.prompt || ''}` : (questionnaireCopy.incomplete || '这里还需要一个回答')
    this.setData({ validationMessage: detail, invalidItemId: itemAnchor(entry.itemId) })
    if (typeof wx !== 'undefined' && typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ selector: `#${itemAnchor(entry.itemId)}`, offsetTop: -24, duration: 180 })
    return true
  },

  commitPendingInputs(itemId) {
    const pending = this.pendingInputs || {}
    const ids = itemId ? [itemId] : Object.keys(pending)
    let changed = false
    for (const currentItemId of ids) {
      if (!hasOwn(pending, currentItemId)) continue
      const value = pending[currentItemId]
      const entry = runtime.getEntry(currentItemId)
      const format = entry && runtime.resolveFormat(entry.item.response)
      const session = store.getSession()
      const storedAnswers = session.latestAnswers || session.answers || {}
      if (value === undefined || value === null || value === '') {
        if (format && (format.allowBlank || format.type === 'free_text')) {
          if (!hasOwn(session.missingness, currentItemId)) {
            store.markMissing(currentItemId, 'NOT_SURE')
            changed = true
          }
          delete pending[currentItemId]
          continue
        }
        this.setData({ validationMessage: (PRODUCT_V0_COPY.questionnaire && PRODUCT_V0_COPY.questionnaire.incomplete) || PRODUCT_V0_COPY.errors.incomplete, invalidItemId: itemAnchor(currentItemId) })
        return false
      }
      if (!entry || !runtime.validateValue(entry, value).ok) {
        this.setData({ validationMessage: (PRODUCT_V0_COPY.errors && PRODUCT_V0_COPY.errors.saveFailed) || '这项回答暂时无法保存', invalidItemId: itemAnchor(currentItemId) })
        return false
      }
      const stored = storedAnswers[currentItemId]
      if (!sameValue(stored, value) || hasOwn(session.missingness, currentItemId)) {
        store.answerItem(currentItemId, value)
        changed = true
      }
      delete pending[currentItemId]
    }
    this.session = store.getSession()
    if (changed) this.markLocalSaved()
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
      try { this.session = store.answerItem(itemId, selected); this.markLocalSaved(); this.setData({ validationMessage: '', invalidItemId: '' }); this.refresh(); this.syncPending() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.incompleteSelection, icon: 'none' }) }
      return
    }
    try { this.session = store.answerItem(itemId, value); this.markLocalSaved(); this.setData({ validationMessage: '', invalidItemId: '' }); this.refresh(); this.syncPending() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.saveFailed, icon: 'none' }) }
  },

  handleInput(event) {
    const itemId = event.currentTarget.dataset.itemId
    if (!this.pendingInputs) this.pendingInputs = {}
    this.pendingInputs[itemId] = event.detail.value
    const itemIndex = this.data.items.findIndex(item => item.itemId === itemId)
    const state = pageState(store.getSession(), this.pendingInputs)
    if (itemIndex < 0) return this.setData({ canContinue: state.canContinue })
    this.setData({ [`items[${itemIndex}].value`]: event.detail.value, canContinue: state.canContinue, validationMessage: '', invalidItemId: '' })
  },

  handleInputBlur(event) {
    const committed = this.commitPendingInputs(event.currentTarget.dataset.itemId)
    this.refresh()
    if (!committed) this.showIncomplete()
  },

  skipItem(event) {
    const itemId = event.currentTarget.dataset.itemId
    delete (this.pendingInputs || {})[itemId]
    try { this.session = store.markMissing(itemId, 'NOT_SURE'); this.markLocalSaved(); this.setData({ validationMessage: '', invalidItemId: '' }); this.refresh(); this.syncPending() } catch (error) { wx.showToast({ title: PRODUCT_V0_COPY.errors.cannotSkip, icon: 'none' }) }
  },

  openPrivacy() { navigateOnce(this, 'navigateTo', { url: '/pages/privacy/index' }) },

  goHome() { navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) },

  retrySync() {
    this.setData({ syncError: '', syncState: 'LOCAL_SAVED', syncStatusLabel: syncLabel('LOCAL_SAVED') })
    this.syncPending()
  },

  finishEditing() {
    if (!this.editing || this._editRouting) return false
    const session = store.getSession()
    const targetTaskId = this.editTaskId || store.currentTaskId(session)
    if (!journey.canFinishEditing(session, targetTaskId)) {
      this.showIncomplete()
      return false
    }
    const wasAssessmentComplete = Boolean(this.wasAssessmentComplete)
    try {
      if (wasAssessmentComplete) store.completeAssessment()
      else if (Number.isInteger(this.resumeTaskIndex)) store.setTaskIndex(this.resumeTaskIndex)
      this.markLocalSaved()
      const saved = store.getSession()
      recordEvent('answer_edit_complete', { taskId: targetTaskId, sectionId: sectionIdForTask(targetTaskId), taskIndex: Number(saved.currentTaskIndex) || 0, wasAssessmentComplete, reportVersion: Number(saved.reportRevision) || 0 })
      const editSavedLabel = PRODUCT_V0_COPY.questionnaire && PRODUCT_V0_COPY.questionnaire.editSaved
      if (editSavedLabel && typeof wx !== 'undefined' && typeof wx.showToast === 'function') wx.showToast({ title: editSavedLabel, icon: 'success' })
      this.syncPending()
      this._editRouting = true
      const returnTo = contextUrl(this.returnContext || { source: wasAssessmentComplete ? 'result' : 'partial-result' })
      return navigateOnce(this, 'redirectTo', { url: returnTo, fail: () => navigateOnce(this, 'reLaunch', { url: returnTo }) })
    } catch (error) {
      this.setData({ validationMessage: (PRODUCT_V0_COPY.errors && PRODUCT_V0_COPY.errors.saveFailed) || '这项回答暂时无法保存' })
      return false
    }
  },

  handleBack() {
    if (!this.commitPendingInputs()) return this.showIncomplete()
    if (this.editing) return this.finishEditing()
    this.syncPending()
    const session = store.getSession()
    if (session.currentTaskIndex <= 0) {
      const section = journey.currentSection(session)
      const sectionPauseAt = Date.now()
      recordEvent('section_pause', { sectionId: section && section.id || '', taskId: store.currentTaskId(session), taskIndex: Number(session.currentTaskIndex) || 0, sectionPauseAt, sectionDurationMs: this._sectionStartedAt ? Math.max(0, sectionPauseAt - this._sectionStartedAt) : null })
      return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) })
    }
    this.session = store.goPrevious()
    this.markLocalSaved()
    this.setData(Object.assign({ motionClass: 'motion-back' }, pageState(this.session, this.pendingInputs)))
    this.syncPending()
  },

  handleContinue() {
    if (this._isRouting) return
    if (!this.commitPendingInputs()) return this.showIncomplete()
    this.refresh()
    if (!this.data.canContinue) return this.showIncomplete()
    if (this.editing) return this.finishEditing()
    const before = store.getSession()
    const currentSection = journey.currentSection(before)
    try {
      const next = store.goNext()
      const nextSection = journey.currentSection(next)
      if (next.status === 'completed' && next.completedAt) {
        if (currentSection) {
          const sectionCompleteAt = Date.now()
          recordEvent('section_complete', { sectionId: currentSection.id, sectionIndex: journey.getSectionProgress(before, currentSection.id).sectionNumber, taskId: store.currentTaskId(before), taskIndex: Number(before.currentTaskIndex) || 0, sectionCompleteAt, sectionDurationMs: this._sectionStartedAt ? Math.max(0, sectionCompleteAt - this._sectionStartedAt) : null })
        }
        recordEvent('final_result_view', { completedCount: journey.getGlobalProgress(next).completedTasks })
        this.syncPending()
        return navigateOnce(this, 'redirectTo', { url: '/pages/v3-result/index?mode=product-v0' })
      }
      const crossedSection = currentSection && nextSection && currentSection.id !== nextSection.id
      this.syncPending()
      if (crossedSection) {
        const sectionCompleteAt = Date.now()
        recordEvent('section_complete', { sectionId: currentSection.id, sectionIndex: journey.getSectionProgress(before, currentSection.id).sectionNumber, taskId: store.currentTaskId(before), taskIndex: Number(before.currentTaskIndex) || 0, sectionCompleteAt, sectionDurationMs: this._sectionStartedAt ? Math.max(0, sectionCompleteAt - this._sectionStartedAt) : null })
        return navigateOnce(this, 'redirectTo', { url: `/pages/v3-checkpoint/index?mode=product-v0&section=${encodeURIComponent(currentSection.id)}&nextIndex=${next.currentTaskIndex}` })
      }
      const nextTask = runtime.getTask(store.currentTaskId(next))
      if (!nextTask) return navigateOnce(this, 'redirectTo', { url: '/pages/v3-result/index?mode=product-v0&scope=partial' })
      this.session = next
      this.markLocalSaved()
      this.setData(Object.assign({ motionClass: 'motion-forward' }, pageState(next, this.pendingInputs)))
    } catch (error) { this.setData({ validationMessage: (PRODUCT_V0_COPY.errors && PRODUCT_V0_COPY.errors.incomplete) || '这里还需要一个回答' }); this.showIncomplete() }
  },

  syncPending() {
    if (this._cloudSyncing) return
    const session = store.getSession()
    if (!store.hasSession() || !session.answerEvents.length) return
    if (!cloud.isCloudReady()) {
      this.setData({ syncState: 'LOCAL_SAVED', syncStatusLabel: syncLabel('LOCAL_SAVED'), syncError: '' })
      return
    }
    this._cloudSyncing = true
    const requestedRevision = sessionRevision(session)
    this.setData({ syncing: true, syncState: 'CLOUD_SYNCING', syncStatusLabel: syncLabel('CLOUD_SYNCING'), syncError: '' })
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
        this.setData({ syncing: false, syncState: 'LOCAL_SAVED', syncStatusLabel: syncLabel('LOCAL_SAVED'), syncError: '' })
        return this.syncPending()
      }
      this.setData({ syncing: false, syncState: 'SYNCED', syncStatusLabel: syncLabel('SYNCED'), syncError: '' })
      this.refresh()
    }
    const fail = error => {
      this._cloudSyncing = false
      this.setData({ syncing: false, syncState: 'CLOUD_FAILED', syncStatusLabel: syncLabel('CLOUD_FAILED'), syncError: cloud.cloudErrorMessage(error) })
    }
    const callbacks = { success, fail }
    if (session.status === 'completed') cloud.completeProductV0ToCloud(session, callbacks)
    else cloud.saveProductV0DraftToCloud(session, callbacks)
  }
})

module.exports = { chapterIndex, buildItems, pageState, progressLabel, progressPercentLabel, progressWidth, sectionPosition, isFirstTask, sessionRevision, PRODUCT_V0_COPY }
