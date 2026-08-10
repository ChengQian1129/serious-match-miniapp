const BUNDLE = require('./generated/runtime-bundle')

const WAVE_IDS = Object.freeze(BUNDLE.waveIds.slice())
const CONTEXT_BASIS = Object.freeze((BUNDLE.contextCapture.allowedContextBasis || []).slice())
const MISSINGNESS_CODES = Object.freeze(BUNDLE.missingnessCodes.slice())

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function assertWaveId(waveId) {
  if (!WAVE_IDS.includes(String(waveId))) throw new Error(`UNKNOWN_WAVE:${waveId}`)
  return String(waveId)
}

function buildWaveAssignment(waveId) {
  const normalizedWaveId = assertWaveId(waveId)
  const taskIds = BUNDLE.taskIdsByWave[normalizedWaveId].slice()
  return {
    waveId: normalizedWaveId,
    instrumentId: BUNDLE.instrument.id,
    instrumentVersion: BUNDLE.instrument.version,
    scoring: BUNDLE.instrument.scoring,
    taskIds,
    assignedParentTaskIds: taskIds.slice(),
    taskCount: taskIds.length
  }
}

function getTask(taskId) {
  return BUNDLE.tasks[String(taskId)] || null
}

function getTaskForItem(itemId) {
  const normalizedItemId = String(itemId)
  const direct = getTask(normalizedItemId)
  if (direct) return { parent: direct, item: direct }
  for (const parent of Object.values(BUNDLE.tasks)) {
    const child = (parent.children || []).find(candidate => candidate.itemId === normalizedItemId)
    if (child) return { parent, item: child }
  }
  return null
}

function itemParentForWave(waveId, itemId) {
  const assignment = buildWaveAssignment(waveId)
  const resolved = getTaskForItem(itemId)
  if (!resolved || !assignment.assignedParentTaskIds.includes(resolved.parent.taskId)) return null
  return resolved.parent.taskId
}

function resolveFormat(responseSpec) {
  if (!responseSpec) return null
  if (responseSpec.formatRef) {
    const format = BUNDLE.responseFormats[responseSpec.formatRef]
    if (!format) throw new Error(`UNKNOWN_FORMAT:${responseSpec.formatRef}`)
    return clone(format)
  }
  if (responseSpec.inlineFormat) return clone(responseSpec.inlineFormat)
  return clone(responseSpec)
}

function responseSpecForItem(itemId) {
  const resolved = getTaskForItem(itemId)
  return resolved ? resolved.item.response : null
}

function validateScalar(format, value) {
  if (!format || !format.type) return { ok: false, reason: 'UNKNOWN_FORMAT' }
  if (format.type === 'single_select') {
    if (value === null || value === undefined || Array.isArray(value)) return { ok: false, reason: 'INVALID_OPTION' }
    const valid = (format.options || []).some(option => option.code !== null && String(option.code) === String(value))
    return { ok: valid, reason: valid ? null : 'INVALID_OPTION' }
  }
  if (format.type === 'multi_select') {
    if (!Array.isArray(value)) return { ok: false, reason: 'MULTI_SELECT_REQUIRED' }
    const values = value.map(String)
    const valid = new Set((format.options || []).filter(option => option.code !== null).map(option => String(option.code)))
    if (!values.every(option => valid.has(option))) return { ok: false, reason: 'INVALID_OPTION' }
    if (new Set(values).size !== values.length) return { ok: false, reason: 'DUPLICATE_OPTION' }
    const validation = format.validation || {}
    if (validation.minSelections !== undefined && values.length < validation.minSelections) return { ok: false, reason: `MIN_SELECTIONS_${validation.minSelections}` }
    if (validation.maxSelections !== undefined && values.length > validation.maxSelections) return { ok: false, reason: `MAX_SELECTIONS_${validation.maxSelections}` }
    return { ok: true, reason: null }
  }
  if (format.type === 'number') {
    if (value === '' || value === null || value === undefined) return { ok: Boolean(format.allowBlank), reason: format.allowBlank ? null : 'NUMBER_REQUIRED' }
    const number = Number(value)
    if (!Number.isFinite(number)) return { ok: false, reason: 'NUMBER_REQUIRED' }
    const validation = format.validation || {}
    if (validation.min !== undefined && number < validation.min) return { ok: false, reason: `NUMBER_MIN_${validation.min}` }
    if (validation.max !== undefined && number > validation.max) return { ok: false, reason: `NUMBER_MAX_${validation.max}` }
    return { ok: true, reason: null }
  }
  if (format.type === 'free_text') {
    if (value === null || value === undefined || String(value).trim() === '') return { ok: false, reason: 'TEXT_REQUIRED' }
    const maxChars = format.maxChars || 10000
    if (String(value).length > maxChars) return { ok: false, reason: `TEXT_MAX_${maxChars}` }
    return { ok: true, reason: null }
  }
  return { ok: false, reason: 'UNKNOWN_FORMAT' }
}

function validateItemResponse(itemId, value) {
  const resolved = getTaskForItem(itemId)
  if (!resolved) return { ok: false, reason: 'UNKNOWN_ITEM' }
  const format = resolveFormat(resolved.item.response)
  return validateScalar(format, value)
}

function validateMissingnessCode(code) {
  return MISSINGNESS_CODES.includes(String(code))
}

function expectedItemIdsForParent(parentTaskId) {
  const task = getTask(parentTaskId)
  if (!task) throw new Error(`UNKNOWN_TASK:${parentTaskId}`)
  if (task.children && task.children.length) return task.children.map(child => child.itemId)
  return task.response ? [task.taskId] : []
}

function isItemAccounted(itemId, latestAnswers = {}, missingness = {}) {
  return Object.prototype.hasOwnProperty.call(latestAnswers, itemId) ||
    Object.prototype.hasOwnProperty.call(missingness, itemId)
}

function isParentComplete(parentTaskId, latestAnswers = {}, missingness = {}) {
  return expectedItemIdsForParent(parentTaskId).every(itemId => isItemAccounted(itemId, latestAnswers, missingness))
}

function progress(assignment, latestAnswers = {}, missingness = {}) {
  const ids = assignment.assignedParentTaskIds || assignment.taskIds || []
  const completedParents = ids.filter(parentTaskId => isParentComplete(parentTaskId, latestAnswers, missingness)).length
  return {
    completedParents,
    assignedParents: ids.length,
    ratio: ids.length ? completedParents / ids.length : 0
  }
}

function publicFormat(responseSpec) {
  const format = resolveFormat(responseSpec)
  if (!format) return null
  return {
    type: format.type,
    ordered: Boolean(format.ordered),
    options: (format.options || []).map(option => ({
      code: option.code === null || option.code === undefined ? '' : String(option.code),
      label: option.label,
      missingCode: option.missingCode || ''
    })),
    validation: clone(format.validation || {}),
    unit: format.unit || '',
    allowBlank: Boolean(format.allowBlank),
    maxChars: format.maxChars || null
  }
}

function getPublicTask(taskIdOrTask) {
  const task = typeof taskIdOrTask === 'string' ? getTask(taskIdOrTask) : taskIdOrTask
  if (!task) return null
  const publicTask = {
    taskId: task.taskId,
    taskType: task.children && task.children.length ? 'compound' : 'response',
    isCompound: Boolean(task.children && task.children.length),
    prompt: task.prompt,
    response: task.children && task.children.length ? null : publicFormat(task.response),
    children: (task.children || []).map(child => ({
      itemId: child.itemId,
      prompt: child.prompt || '',
      response: publicFormat(child.response)
    }))
  }
  return publicTask
}

function getResearchTask(taskIdOrTask) {
  const task = typeof taskIdOrTask === 'string' ? getTask(taskIdOrTask) : taskIdOrTask
  return task ? clone(task) : null
}

function getPublicTaskIds(waveId) {
  return buildWaveAssignment(waveId).taskIds
}

function validateRelationshipContext(context) {
  const value = context && typeof context === 'object' ? context : {}
  const required = BUNDLE.contextCapture.required || []
  const missing = required.filter(field => typeof value[field] !== 'string' || !value[field].trim())
  const responseContext = value.responseContextForRelationshipItems
  if (responseContext && !CONTEXT_BASIS.includes(responseContext)) missing.push('responseContextForRelationshipItems:UNKNOWN_VALUE')
  if (missing.length) return { ok: false, reason: 'INVALID_RELATIONSHIP_CONTEXT', missing }
  return { ok: true, value: {
    relationshipHistoryCategory: value.relationshipHistoryCategory.trim(),
    currentDatingStatus: value.currentDatingStatus.trim(),
    responseContextForRelationshipItems: responseContext
  } }
}

function validateParticipantStudyId(participantStudyId) {
  const value = String(participantStudyId || '').trim()
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,63}$/.test(value)) return { ok: false, reason: 'INVALID_PARTICIPANT_STUDY_ID' }
  return { ok: true, value }
}

module.exports = {
  BUNDLE,
  WAVE_IDS,
  CONTEXT_BASIS,
  MISSINGNESS_CODES,
  clone,
  buildWaveAssignment,
  buildAssignment: buildWaveAssignment,
  getTask,
  getTaskForItem,
  itemParentForWave,
  getPublicTaskIds,
  getPublicTask,
  getResearchTask,
  resolveFormat,
  responseSpecForItem,
  validateItemResponse,
  validateMissingnessCode,
  expectedItemIdsForParent,
  isItemAccounted,
  isParentComplete,
  progress,
  validateRelationshipContext,
  validateParticipantStudyId
}
