const engine = require('../../shared/assessment-v3-p0/runtime-engine')
const store = require('../../utils/assessment-v3-p0/session-store')
const archive = require('../../utils/assessment-v3-p0/research-archive')
const { FEATURES } = require('../../utils/features')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const publicLanguage = require('../../shared/content/public-language.generated')

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function asString(value) {
  return value === null || value === undefined ? '' : String(value)
}

function responseView(itemId, response, session) {
  const answer = session.latestAnswers[itemId]
  const missing = session.missingness[itemId] || null
  const selectedValues = Array.isArray(answer) ? answer.map(asString) : []
  return Object.assign({}, response, {
    itemId,
    value: answer === undefined || answer === null ? '' : answer,
    hasAnswer: hasOwn(session.latestAnswers, itemId),
    missing: Boolean(missing),
    missingCode: missing ? missing.code : '',
    options: (response.options || []).map(option => ({
      code: option.code,
      label: option.label,
      missingCode: option.missingCode || '',
      isMissing: Boolean(option.missingCode),
      selected: option.missingCode
        ? Boolean(missing && missing.code === option.missingCode)
        : Array.isArray(answer)
          ? selectedValues.includes(String(option.code))
          : answer !== undefined && answer !== null && String(answer) === String(option.code)
    }))
  })
}

function buildTaskView(task, session) {
  if (!task) return null
  const items = task.isCompound
    ? task.children.map(child => ({
      itemId: child.itemId,
      prompt: child.prompt,
      response: responseView(child.itemId, child.response, session)
    }))
    : [{ itemId: task.taskId, prompt: '', response: responseView(task.taskId, task.response, session) }]
  const expected = engine.expectedItemIdsForParent(task.taskId)
  const accounted = expected.filter(itemId => engine.isItemAccounted(itemId, session.latestAnswers, session.missingness)).length
  return {
    taskId: task.taskId,
    prompt: task.prompt,
    isCompound: task.isCompound,
    items,
    accounted,
    expectedCount: expected.length
  }
}

function decodeOption(value) {
  try { return decodeURIComponent(value || '') } catch (error) { return value || '' }
}

function errorCopy(error) {
  const message = error && error.message ? error.message : String(error || '')
  if (message.includes('MAX_SELECTIONS_')) return `Maximum selections: ${message.split('MAX_SELECTIONS_')[1]}`
  if (message.includes('MIN_SELECTIONS_')) return `Minimum selections: ${message.split('MIN_SELECTIONS_')[1]}`
  if (message.includes('NUMBER_MIN_')) return `Minimum value: ${message.split('NUMBER_MIN_')[1]}`
  if (message.includes('NUMBER_MAX_')) return `Maximum value: ${message.split('NUMBER_MAX_')[1]}`
  if (message.includes('TEXT_MAX_')) return `Maximum characters: ${message.split('TEXT_MAX_')[1]}`
  if (message.includes('CURRENT_TASK_INCOMPLETE')) return publicLanguage.publicErrors.incomplete
  return publicLanguage.publicErrors.questionInvalid
}

Page({
  data: {
    loaded: false,
    enabled: false,
    setup: true,
    active: false,
    completed: false,
    readyForCoding: false,
    pageTitle: publicLanguage.ui.v3Pilot.pageTitle,
    completionTitle: publicLanguage.ui.v3Pilot.completion,
    completionNote: publicLanguage.ui.v3Pilot.completionNote,
    completionFollowup: publicLanguage.ui.v3Pilot.completionFollowup,
    skipLabel: publicLanguage.ui.v3Pilot.skipDisplay,
    waveOptions: engine.WAVE_IDS.map(waveId => ({ value: waveId, label: waveId })),
    waveId: 'wave1',
    participantStudyId: '',
    relationshipHistoryCategory: 'CURRENT_DATING',
    currentDatingStatus: '',
    responseContextForRelationshipItems: 'CURRENT_DATING',
    contextBasisOptions: engine.CONTEXT_BASIS.map(value => ({ value, label: value })),
    task: null,
    progressText: '',
    progressRatio: 0,
    canPrevious: false,
    canContinue: false,
    canSkip: true,
    error: '',
    notice: '',
    motionClass: 'p0-content--enter-forward'
  },

  onLoad(options = {}) {
    if (!FEATURES.v3P0Research) {
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      return
    }
    this._loaded = true
    this._draftValues = {}
    this._lastShownTaskId = null
    const session = store.getSession()
    const initial = {
      loaded: true,
      enabled: true,
      waveId: engine.WAVE_IDS.includes(options.waveId) ? options.waveId : this.data.waveId,
      participantStudyId: decodeOption(options.participantStudyId) || this.data.participantStudyId,
      relationshipHistoryCategory: decodeOption(options.relationshipHistoryCategory) || this.data.relationshipHistoryCategory,
      currentDatingStatus: decodeOption(options.currentDatingStatus) || this.data.currentDatingStatus,
      responseContextForRelationshipItems: decodeOption(options.responseContextForRelationshipItems) || this.data.responseContextForRelationshipItems
    }
    this.setData(initial)
    if (session) this.refresh('forward')
  },

  onShow() {
    resetNavigation(this)
    if (this._loaded && store.getSession()) this.refresh()
  },

  chooseWave(event) {
    this.setData({ waveId: event.currentTarget.dataset.waveId, error: '' })
  },

  inputSetup(event) {
    const value = event.currentTarget.dataset.value !== undefined
      ? event.currentTarget.dataset.value
      : event.detail.value
    this.setData({ [event.currentTarget.dataset.field]: value, error: '' })
  },

  startResearch() {
    try {
      const session = store.startSession({
        waveId: this.data.waveId,
        participantStudyId: this.data.participantStudyId,
        relationshipContext: {
          relationshipHistoryCategory: this.data.relationshipHistoryCategory,
          currentDatingStatus: this.data.currentDatingStatus,
          responseContextForRelationshipItems: this.data.responseContextForRelationshipItems
        }
      })
      this._lastShownTaskId = null
      this._draftValues = {}
      this.setData({ error: '', notice: '', active: true, setup: false, completed: false, readyForCoding: false })
      this.refresh('forward')
      return session
    } catch (error) {
      this.setData({ error: errorCopy(error) })
      return null
    }
  },

  refresh(direction) {
    const session = store.getSession()
    if (!session) {
      this.setData({ loaded: true, active: false, setup: true, completed: false, readyForCoding: false, task: null })
      return
    }
    if (session.status === 'completed_no_scoring') {
      this.setData({ loaded: true, active: false, setup: false, completed: true, readyForCoding: false, task: null, error: '', motionClass: '' })
      return
    }
    const taskId = store.currentTaskId(session)
    const task = engine.getPublicTask(taskId)
    if (!task) {
      this.setData({ loaded: true, active: true, setup: false, error: publicLanguage.publicErrors.loadFailed })
      return
    }
    if (taskId !== this._lastShownTaskId) {
      try { store.recordTaskShown(taskId) } catch (error) { this.setData({ error: publicLanguage.publicErrors.loadFailed }) }
      this._lastShownTaskId = taskId
    }
    const current = store.getSession()
    const progress = store.getProgress()
    const expected = engine.expectedItemIdsForParent(taskId)
    const accounted = expected.every(itemId => engine.isItemAccounted(itemId, current.latestAnswers, current.missingness))
    const isLast = current.currentTaskIndex >= current.assignment.assignedParentTaskIds.length - 1
    const readyForCoding = isLast && accounted && current.taskEvents.some(event => event.eventType === 'RESEARCH_READY_FOR_DEBRIEF')
    this.setData({
      loaded: true,
      active: true,
      setup: false,
      completed: false,
      readyForCoding,
      task: buildTaskView(task, current),
      progressText: `${progress.completedParents} / ${progress.assignedParents}`,
      progressRatio: progress.ratio,
      canPrevious: current.currentTaskIndex > 0,
      canContinue: accounted,
      canSkip: !accounted,
      isLast,
      error: direction ? '' : this.data.error,
      notice: direction ? '' : this.data.notice,
      motionClass: direction ? `p0-content--enter-${direction}` : ''
    })
  },

  chooseOption(event) {
    const { itemId, code, missingCode } = event.currentTarget.dataset
    try {
      if (missingCode) {
        store.markMissing(itemId, String(missingCode))
      } else {
        const item = (this.data.task.items || []).find(candidate => candidate.itemId === itemId)
        const session = store.getSession()
        if (item && item.response.type === 'multi_select') {
          const current = Array.isArray(session.latestAnswers[itemId]) ? session.latestAnswers[itemId].map(asString) : []
          const next = current.includes(String(code)) ? current.filter(value => value !== String(code)) : current.concat(String(code))
          store.answerItem(itemId, next)
        } else {
          store.answerItem(itemId, String(code))
        }
      }
      this.setData({ error: '', notice: '' })
      this.refresh()
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
    }
  },

  inputValue(event) {
    this._draftValues[event.currentTarget.dataset.itemId] = event.detail.value
    this.setData({ error: '', notice: '' })
  },

  commitInput(event) {
    const itemId = event.currentTarget.dataset.itemId
    const raw = event.detail.value
    const item = (this.data.task.items || []).find(candidate => candidate.itemId === itemId)
    const value = item && item.response.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw
    try {
      store.answerItem(itemId, value)
      delete this._draftValues[itemId]
      this.setData({ error: '', notice: '' })
      this.refresh()
    } catch (error) {
      this.setData({ error: errorCopy(error) })
    }
  },

  commitDrafts() {
    const drafts = this._draftValues || {}
    const items = (this.data.task && this.data.task.items) || []
    items.forEach(item => {
      if (!hasOwn(drafts, item.itemId)) return
      const raw = drafts[item.itemId]
      const value = item.response.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw
      store.answerItem(item.itemId, value)
      delete drafts[item.itemId]
    })
  },

  skipCurrent() {
    const session = store.getSession()
    const taskId = session && store.currentTaskId(session)
    if (!taskId) return
    try {
      this.commitDrafts()
      const latest = store.getSession()
      engine.expectedItemIdsForParent(taskId).forEach(itemId => {
        if (!engine.isItemAccounted(itemId, latest.latestAnswers, latest.missingness)) store.markMissing(itemId, 'USER_SKIPPED')
      })
      this.setData({ error: '', notice: publicLanguage.ui.v3Pilot.skipDisplay })
      this.refresh()
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
    }
  },

  handlePrevious() {
    if (this._isRouting) return
    try {
      this.commitDrafts()
      const session = store.getSession()
      if (!session || session.currentTaskIndex <= 0) return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) })
      store.goPrevious()
      this.refresh('back')
    } catch (error) {
      this.setData({ error: errorCopy(error) })
    }
  },

  handleContinue() {
    if (this._isRouting) return
    try {
      this.commitDrafts()
      const next = store.goNext()
      const isReady = next.currentTaskIndex >= next.assignment.assignedParentTaskIds.length - 1 && engine.isParentComplete(store.currentTaskId(next), next.latestAnswers, next.missingness)
      if (isReady) {
        this.setData({ readyForCoding: true, canContinue: false, notice: '' })
      } else this.refresh('forward')
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
    }
  },

  openCoding() {
    navigateOnce(this, 'navigateTo', { url: '/pages/v3-p0-coding/index' })
  },

  exitResearch() {
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  archiveCompleted() {
    const session = store.getSession()
    if (!session || session.status !== 'completed_no_scoring') return
    try { archive.appendCompletedSession(session); this.setData({ notice: 'Archived.' }) } catch (error) { this.setData({ error: errorCopy(error) }) }
  }
})

module.exports = { buildTaskView, responseView, errorCopy }
