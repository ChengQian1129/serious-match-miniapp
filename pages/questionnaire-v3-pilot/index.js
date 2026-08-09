const {
  getSession,
  answerItem,
  markMissing,
  appendTaskEvent,
  currentParentTaskId,
  goNext,
  goPrevious,
  getProgress
} = require('../../utils/assessment-v3-pilot/session-store')

const {
  getPublicTask,
  resolvePublicFormat,
  expectedItemIdsForParent
} = require('../../shared/assessment-v3-pilot/runtime-engine')
const { FEATURES } = require('../../utils/features')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { publicError, classifyError } = require('../../shared/content/public-errors')
const publicLanguage = require('../../shared/content/public-language.generated')

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function asString(value) {
  return value === null || value === undefined ? '' : String(value)
}

function formatHint(format) {
  if (!format) return ''
  if (format.type === 'multi_select') {
    const validation = format.validation || {}
    if (validation.minSelections && validation.maxSelections) return `请选择 ${validation.minSelections}–${validation.maxSelections} 项`
    if (validation.minSelections) return `至少选择 ${validation.minSelections} 项`
    if (validation.maxSelections) return `最多选择 ${validation.maxSelections} 项`
  }
  if (format.type === 'number') {
    const validation = format.validation || {}
    const range = validation.min !== undefined && validation.max !== undefined ? `${validation.min}–${validation.max}` : ''
    const optional = format.allowBlank ? '，也可以留空' : ''
    return `${range}${format.unit ? ` ${format.unit}` : ''}${optional}`.trim()
  }
  if (format.type === 'free_text') return `最多 ${format.maxChars || 300} 字`
  return ''
}

function optionView(option, selectedValue, missing) {
  const missingCode = option.missingCode || ''
  const valueKey = option.code === null || option.code === undefined ? `missing:${missingCode}` : String(option.code)
  const selectedValues = Array.isArray(selectedValue) ? selectedValue.map(asString) : []
  const selected = missingCode
    ? Boolean(missing && missing.code === missingCode)
    : Array.isArray(selectedValue)
      ? selectedValues.includes(valueKey)
      : hasOwn({ value: selectedValue }, 'value') && selectedValue !== undefined && selectedValue !== null && asString(selectedValue) === valueKey
  return {
    code: valueKey,
    label: option.label,
    selected,
    missingCode,
    isMissing: Boolean(missingCode)
  }
}

function responseView(itemId, response, answers, missingness, parentTaskId) {
  const format = resolvePublicFormat(response, itemId, parentTaskId)
  const selectedValue = answers[itemId]
  const missing = missingness[itemId] || null
  const value = selectedValue === undefined || selectedValue === null ? '' : selectedValue
  return {
    itemId,
    type: format.type,
    options: (format.options || []).map(option => optionView(option, selectedValue, missing)),
    value,
    hasAnswer: hasOwn(answers, itemId),
    missing: Boolean(missing),
    missingCode: missing ? missing.code : '',
    hint: formatHint(format),
    unit: format.unit || '',
    maxLength: format.maxChars || 300,
    placeholder: format.type === 'number' ? '输入数字' : '写下你的回答',
    validation: format.validation || {}
  }
}

function buildTaskView(task, session) {
  if (!task) return null
  const answers = session.answers || {}
  const missingness = session.missingness || {}
  const items = task.children && task.children.length
    ? task.children.map(child => ({
      itemId: child.itemId,
      prompt: child.prompt,
      response: responseView(child.itemId, child.response, answers, missingness, task.taskId)
    }))
    : [{
      itemId: task.taskId,
      prompt: '',
      response: responseView(task.taskId, task.response, answers, missingness, task.taskId)
    }]
  const expected = expectedItemIdsForParent(task.taskId)
  const accounted = expected.filter(itemId => hasOwn(answers, itemId) || hasOwn(missingness, itemId)).length
  const meta = task.freezeMeta || {}
  return {
    taskId: task.taskId,
    prompt: task.prompt,
    taskType: task.taskType,
    isCompound: Boolean(task.children && task.children.length),
    items,
    itemCount: items.length,
    accounted,
    expectedCount: expected.length,
    section: task.section || '',
    constructId: '',
    responseContext: ''
  }
}

function errorMessage(error) {
  const message = error && error.message ? error.message : String(error || '')
  if (message.includes('MAX_SELECTIONS_')) return `最多选择 ${message.split('MAX_SELECTIONS_')[1]} 项。`
  if (message.includes('MIN_SELECTIONS_')) return `至少选择 ${message.split('MIN_SELECTIONS_')[1]} 项。`
  if (message.includes('NUMBER_MIN_')) return `请输入不小于 ${message.split('NUMBER_MIN_')[1]} 的数字。`
  if (message.includes('NUMBER_MAX_')) return `请输入不大于 ${message.split('NUMBER_MAX_')[1]} 的数字。`
  if (message.includes('TEXT_MAX_')) return `回答不能超过 ${message.split('TEXT_MAX_')[1]} 字。`
  if (message.includes('TEXT_REQUIRED')) return '请写下你的回答，或者先返回上一题。'
  if (message.includes('最多选择')) return message
  if (message.includes('至少选择')) return message
  if (message.includes('ITEM_NOT_ASSIGNED') || message.includes('不在当前')) return '这道题当前不可用，请返回上一题再试。'
  if (message.includes('仍有')) return '请先完成这道题，或选择“暂时跳过”。'
  if (message.includes('无效')) return '请检查这道题的填写内容。'
  return publicError('generic')
}

function recordErrorEvent(itemId, error) {
  try {
    appendTaskEvent('ERROR', {
      parentTaskId: currentParentTaskId(getSession()),
      itemId: itemId || null,
      message: error && error.message ? error.message : String(error || 'UNKNOWN_ERROR')
    })
  } catch (ignored) {}
}

Page({
  data: {
    loaded: false,
    completed: false,
    status: 'draft_local',
    task: null,
    formLabel: '',
    progressText: '',
    progressRatio: 0,
    canPrevious: false,
    canContinue: false,
    canSkip: true,
    skipLabel: publicLanguage.ui.v3Pilot.skipDisplay,
    completionTitle: publicLanguage.ui.v3Pilot.completion,
    completionNote: publicLanguage.ui.v3Pilot.completionNote,
    completionFollowup: publicLanguage.ui.v3Pilot.completionFollowup,
    error: '',
    skipNotice: '',
    motionClass: 'v3-pilot-content--enter-forward'
  },

  onLoad() {
    if (!FEATURES.v3Pilot) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this._loaded = true
    this._draftValues = {}
    this._lastShownTaskId = null
    this.refresh('forward')
  },

  onShow() {
    resetNavigation(this)
    if (this._loaded) this.refresh()
  },

  refresh(direction) {
    const session = getSession()
    if (session.status === 'completed_no_scoring') {
      this.setData({ loaded: true, completed: true, status: session.status, task: null, error: '', skipNotice: '', motionClass: '' })
      return
    }
    const taskId = currentParentTaskId(session)
    const task = getPublicTask(taskId)
    if (!task) {
      this.setData({ loaded: true, completed: false, task: null, error: publicError('loadFailed') })
      return
    }
    if (taskId !== this._lastShownTaskId) {
      appendTaskEvent('TASK_SHOWN', {
        parentTaskId: taskId,
        itemIds: expectedItemIdsForParent(taskId),
        formKey: session.assignment.formKey,
        formId: session.assignment.formId
      })
      this._lastShownTaskId = taskId
    }
    const current = getSession()
    const progressState = getProgress()
    const expected = expectedItemIdsForParent(taskId)
    const accounted = expected.every(itemId => hasOwn(current.answers, itemId) || hasOwn(current.missingness, itemId))
    this.setData({
      loaded: true,
      completed: false,
      status: current.status,
      task: buildTaskView(task, current),
      formLabel: '答题',
      progressText: `${progressState.completedParents} / ${progressState.assignedParents}`,
      progressRatio: progressState.ratio,
      canPrevious: current.currentParentIndex > 0,
      canContinue: accounted,
      canSkip: !accounted,
      skipLabel: accounted ? '本题已完成' : publicLanguage.ui.v3Pilot.skipDisplay,
      error: direction ? '' : this.data.error,
      skipNotice: direction ? '' : this.data.skipNotice,
      motionClass: direction ? `v3-pilot-content--enter-${direction}` : ''
    })
  },

  commitResponse(itemId, rawValue, options = {}) {
    try {
      const next = answerItem(itemId, rawValue)
      delete this._draftValues[itemId]
      if (!options.silent) this.refresh()
      return next
    } catch (error) {
      if (!options.silent) this.setData({ error: classifyError(error, 'questionInvalid'), skipNotice: '' })
      throw error
    }
  },

  chooseOption(event) {
    const { itemId, code, missingCode } = event.currentTarget.dataset
    try {
      if (missingCode) {
        markMissing(itemId, String(missingCode))
      } else {
        const task = this.data.task && this.data.task.items.find(item => item.itemId === itemId)
        const isMulti = task && task.response.type === 'multi_select'
        if (isMulti) {
          const session = getSession()
          const current = Array.isArray(session.answers[itemId]) ? session.answers[itemId].map(asString) : []
          const next = current.includes(String(code)) ? current.filter(value => value !== String(code)) : current.concat(String(code))
          this.commitResponse(itemId, next, { silent: true })
        } else {
          this.commitResponse(itemId, String(code), { silent: true })
        }
      }
      this.setData({ error: '', skipNotice: '' })
      this.refresh()
    } catch (error) {
      recordErrorEvent(itemId, error)
      this.setData({ error: classifyError(error, 'questionInvalid'), skipNotice: '' })
    }
  },

  inputValue(event) {
    const itemId = event.currentTarget.dataset.itemId
    this._draftValues[itemId] = event.detail.value
    this.setData({ error: '', skipNotice: '' })
  },

  commitInput(event) {
    const itemId = event.currentTarget.dataset.itemId
    const raw = event.detail.value
    const response = this.data.task && this.data.task.items.find(item => item.itemId === itemId)
    const value = response && response.response.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw
    try {
      this.commitResponse(itemId, value)
      this.setData({ error: '' })
    } catch (error) {
      recordErrorEvent(itemId, error)
      this.setData({ error: classifyError(error, 'questionInvalid') })
    }
  },

  commitDrafts() {
    const drafts = this._draftValues || {}
    const task = this.data.task
    if (!task) return
    for (const item of task.items) {
      if (!hasOwn(drafts, item.itemId)) continue
      const value = item.response.type === 'number' ? (drafts[item.itemId] === '' ? '' : Number(drafts[item.itemId])) : drafts[item.itemId]
      this.commitResponse(item.itemId, value, { silent: true })
    }
  },

  skipCurrent() {
    const session = getSession()
    const taskId = currentParentTaskId(session)
    if (!taskId) return
    try {
      this.commitDrafts()
      const latest = getSession()
      expectedItemIdsForParent(taskId).forEach(itemId => {
        if (!isAccounted(latest, itemId)) markMissing(itemId, 'USER_SKIPPED')
      })
      this.setData({ error: '', skipNotice: publicLanguage.ui.v3Pilot.skipDisplay })
      this.refresh()
    } catch (error) {
      recordErrorEvent(null, error)
      this.setData({ error: classifyError(error, 'questionInvalid'), skipNotice: '' })
    }
  },

  previous() {
    this.handlePrevious()
  },

  handlePrevious() {
    if (this._isRouting) return
    try { this.commitDrafts() } catch (error) { this.setData({ error: classifyError(error, 'questionInvalid') }) }
    const session = getSession()
    if (session.currentParentIndex <= 0) {
      return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) })
    }
    goPrevious()
    this.refresh('back')
  },

  continue() {
    this.handleContinue()
  },

  handleContinue() {
    if (this._isRouting) return
    try {
      this.commitDrafts()
      const session = getSession()
      const taskId = currentParentTaskId(session)
      const expected = taskId ? expectedItemIdsForParent(taskId) : []
      const accounted = expected.every(itemId => isAccounted(session, itemId))
      if (!accounted) throw new Error('当前题目仍有未完成的回答')
      const next = goNext()
      if (next.status === 'completed_no_scoring') return this.refresh('forward')
      this.refresh('forward')
    } catch (error) {
      recordErrorEvent(null, error)
      this.setData({ error: classifyError(error, 'questionInvalid'), skipNotice: '' })
    }
  },

  exitPilot() {
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  restartPilot() {
    const store = require('../../utils/assessment-v3-pilot/session-store')
    store.resetSession()
    this._lastShownTaskId = null
    this._draftValues = {}
    this.refresh('forward')
  }
})

function isAccounted(session, itemId) {
  return hasOwn(session.answers, itemId) || hasOwn(session.missingness, itemId)
}

module.exports = { buildTaskView, responseView, optionView, formatHint, errorMessage }
