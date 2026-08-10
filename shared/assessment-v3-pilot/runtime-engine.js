const BUNDLE = require('./runtime-bundle')

function hashToUInt(seed) {
  // FNV-1a plus a small avalanche step keeps assignment deterministic in WeChat's JS runtime.
  const text = String(seed)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b) >>> 0
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0
  hash ^= hash >>> 16
  return hash >>> 0
}

function createRng(seed) {
  let state = hashToUInt(seed) || 0x9e3779b9
  return function next() {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
}

function sampleWithoutReplacement(values, count, rng) {
  if (count > values.length) throw new Error(`sample ${count} > pool ${values.length}`)
  const copy = values.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy.slice(0, count)
}

function formKeyFromSeed(seed) {
  const rng = createRng(`${seed}:form`)
  return ['A', 'B', 'C'][Math.floor(rng() * 3)]
}

function sampleForm(formKey, seed) {
  const form = BUNDLE.forms[formKey]
  if (!form) throw new Error(`Unknown form ${formKey}`)
  const rng = createRng(`${seed}:pools`)
  const chosen = []
  Object.entries(form.pools).forEach(([poolId, def]) => {
    const values = def.pool || []
    chosen.push(...sampleWithoutReplacement(values, def.sample, rng))
  })
  return chosen
}

function codeOf(answers, taskId) {
  const value = answers[taskId]
  if (value === undefined || value === null) return null
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'object' && value.responseCode !== undefined) return String(value.responseCode)
  return String(value)
}

function conditionMatches(condition, answers) {
  const code = codeOf(answers, condition.taskId)
  return code !== null && condition.codes.map(String).includes(code)
}

function evaluateEarlyBranches(answers) {
  const enabled = []
  const branchIds = []
  BUNDLE.branches.early.forEach(branch => {
    let match = false
    if (branch.when) match = conditionMatches(branch.when, answers)
    if (branch.whenAny) match = branch.whenAny.some(rule => conditionMatches(rule, answers))
    if (match) {
      branchIds.push(branch.id)
      branch.enable.forEach(id => { if (!enabled.includes(id)) enabled.push(id) })
    }
  })
  return { branchIds, taskIds: enabled }
}

function buildAssignment(seed, answers = {}) {
  const formKey = formKeyFromSeed(seed)
  const early = evaluateEarlyBranches(answers)
  const common = BUNDLE.commonSpine.slice()
  const form = sampleForm(formKey, seed)
  const ordered = [...common, ...early.taskIds, ...form]
  const seen = new Set()
  const duplicateIds = []
  ordered.forEach(id => {
    if (seen.has(id)) duplicateIds.push(id)
    seen.add(id)
  })
  if (duplicateIds.length) throw new Error(`Duplicate assigned tasks: ${duplicateIds.join(', ')}`)
  return {
    seed: String(seed),
    formKey,
    formId: BUNDLE.forms[formKey].id,
    commonTaskIds: common,
    earlyBranchIds: early.branchIds,
    earlyBranchTaskIds: early.taskIds,
    formTaskIds: form,
    assignedParentTaskIds: ordered
  }
}

function responseSpecFor(task) {
  if (task.response) return task.response
  if (task.children) return { children: task.children }
  return null
}

function resolveFormat(responseSpec) {
  if (!responseSpec) return null
  if (responseSpec.formatRef) {
    const fmt = BUNDLE.responseFormats[responseSpec.formatRef]
    if (!fmt) throw new Error(`Unknown formatRef ${responseSpec.formatRef}`)
    return fmt
  }
  if (responseSpec.inlineFormat) return responseSpec.inlineFormat
  return responseSpec
}

function validateScalar(format, value) {
  if (format.type === 'single_select') {
    const options = format.options || []
    const valid = options.map(x => String(x.code))
    return valid.includes(String(value))
  }
  if (format.type === 'multi_select') {
    if (!Array.isArray(value)) return false
    const valid = new Set((format.options || []).map(x => String(x.code)))
    if (!value.every(x => valid.has(String(x)))) return false
    const min = format.validation && format.validation.minSelections
    const max = format.validation && format.validation.maxSelections
    if (min !== undefined && value.length < min) return false
    if (max !== undefined && value.length > max) return false
    return true
  }
  if (format.type === 'number') {
    if (value === '' || value === null || value === undefined) return Boolean(format.allowBlank)
    const n = Number(value)
    if (!Number.isFinite(n)) return false
    const v = format.validation || {}
    if (v.min !== undefined && n < v.min) return false
    if (v.max !== undefined && n > v.max) return false
    return true
  }
  if (format.type === 'free_text') {
    if (value === null || value === undefined) return false
    return String(value).length <= (format.maxChars || 10000)
  }
  return false
}

function responseFailureReason(format, value) {
  if (!format) return 'UNKNOWN_FORMAT'
  if (format.type === 'single_select') {
    return (format.options || []).some(option => String(option.code) === String(value)) ? 'INVALID_RESPONSE' : 'INVALID_OPTION'
  }
  if (format.type === 'multi_select') {
    if (!Array.isArray(value)) return 'MULTI_SELECT_REQUIRED'
    const valid = new Set((format.options || []).map(option => String(option.code)))
    if (!value.every(option => valid.has(String(option)))) return 'INVALID_OPTION'
    const validation = format.validation || {}
    if (validation.minSelections !== undefined && value.length < validation.minSelections) return `MIN_SELECTIONS_${validation.minSelections}`
    if (validation.maxSelections !== undefined && value.length > validation.maxSelections) return `MAX_SELECTIONS_${validation.maxSelections}`
    return 'INVALID_RESPONSE'
  }
  if (format.type === 'number') {
    if (value === '' || value === null || value === undefined) return format.allowBlank ? 'INVALID_RESPONSE' : 'NUMBER_REQUIRED'
    if (!Number.isFinite(Number(value))) return 'NUMBER_REQUIRED'
    const validation = format.validation || {}
    if (validation.min !== undefined && Number(value) < validation.min) return `NUMBER_MIN_${validation.min}`
    if (validation.max !== undefined && Number(value) > validation.max) return `NUMBER_MAX_${validation.max}`
    return 'INVALID_RESPONSE'
  }
  if (format.type === 'free_text') {
    if (value === null || value === undefined || String(value).trim() === '') return 'TEXT_REQUIRED'
    if (String(value).length > (format.maxChars || 10000)) return `TEXT_MAX_${format.maxChars || 10000}`
    return 'INVALID_RESPONSE'
  }
  return 'INVALID_RESPONSE'
}

function validateItemResponse(itemId, value) {
  const parentId = itemId.includes('.') ? itemId.split('.').slice(0, -1).join('.') : itemId
  const parent = BUNDLE.tasks[parentId]
  if (!parent) return { ok: false, reason: 'UNKNOWN_TASK' }
  if (itemId === parentId) {
    const spec = resolveFormat(parent.response)
    if (!spec) return { ok: false, reason: 'PARENT_HAS_NO_DIRECT_RESPONSE' }
    const ok = validateScalar(spec, value)
    return { ok, reason: ok ? null : responseFailureReason(spec, value) }
  }
  const child = (parent.children || []).find(x => x.itemId === itemId)
  if (!child) return { ok: false, reason: 'UNKNOWN_CHILD' }
  const spec = resolveFormat(child.response)
  const ok = validateScalar(spec, value)
  return { ok, reason: ok ? null : responseFailureReason(spec, value) }
}

function isItemAccounted(itemId, answers = {}, missingness = {}) {
  return Object.prototype.hasOwnProperty.call(answers, itemId) ||
    Object.prototype.hasOwnProperty.call(missingness, itemId)
}

function expectedItemIdsForParent(parentTaskId) {
  const task = BUNDLE.tasks[parentTaskId]
  if (!task) throw new Error(`Unknown task ${parentTaskId}`)
  if (task.children && task.children.length) return task.children.map(x => x.itemId)
  if (task.response) return [parentTaskId]
  return []
}

function isParentComplete(parentTaskId, answers = {}, missingness = {}) {
  return expectedItemIdsForParent(parentTaskId).every(id => isItemAccounted(id, answers, missingness))
}

function progress(assignment, answers = {}, missingness = {}) {
  const total = assignment.assignedParentTaskIds.length
  const complete = assignment.assignedParentTaskIds.filter(id => isParentComplete(id, answers, missingness)).length
  return { completedParents: complete, assignedParents: total, ratio: total ? complete / total : 0 }
}

function getTask(taskId) {
  return BUNDLE.tasks[taskId] || null
}

function publicOptionLabels(responseSpec, itemId, parentTaskId) {
  const format = resolveFormat(responseSpec)
  if (!format) return {}
  const publicCopy = BUNDLE.publicCopy || {}
  return Object.assign({},
    (publicCopy.responseFormatOptions || {})[responseSpec.formatRef] || {},
    (publicCopy.taskOptions || {})[itemId] || {},
    (publicCopy.taskSpecificOptions || {})[parentTaskId] || {}
  )
}

function resolvePublicFormat(responseSpec, itemId, parentTaskId) {
  const format = resolveFormat(responseSpec)
  if (!format) return null
  const labels = publicOptionLabels(responseSpec, itemId, parentTaskId)
  if (!Object.keys(labels).length) return format
  return Object.assign({}, format, {
    options: (format.options || []).map(option => Object.assign({}, option, labels[String(option.code)] ? { label: labels[String(option.code)] } : {}))
  })
}

function getPublicTask(taskIdOrTask) {
  const task = typeof taskIdOrTask === 'string' ? getTask(taskIdOrTask) : taskIdOrTask
  if (!task) return null
  const publicCopy = BUNDLE.publicCopy || {}
  const taskId = task.taskId
  const publicTask = Object.assign({}, task, {
    prompt: (publicCopy.taskPrompts || {})[taskId] || task.prompt,
    section: task.freezeMeta && task.freezeMeta.chapter && (publicCopy.chapterTitles || {})[task.freezeMeta.chapter] || ''
  })
  if (Array.isArray(task.children)) {
    publicTask.children = task.children.map(child => Object.assign({}, child, {
      prompt: (publicCopy.childPrompts || {})[child.itemId] || child.prompt
    }))
  }
  return publicTask
}

function getDeferredBranches() {
  return BUNDLE.branches.deferred.slice()
}

module.exports = {
  BUNDLE,
  hashToUInt,
  createRng,
  sampleWithoutReplacement,
  formKeyFromSeed,
  sampleForm,
  evaluateEarlyBranches,
  buildAssignment,
  resolveFormat,
  validateItemResponse,
  expectedItemIdsForParent,
  isItemAccounted,
  isParentComplete,
  progress,
  getTask,
  getPublicTask,
  resolvePublicFormat,
  getDeferredBranches
}
