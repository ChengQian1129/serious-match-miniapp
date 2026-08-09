const {
  BUNDLE,
  buildAssignment,
  validateItemResponse,
  expectedItemIdsForParent,
  isParentComplete,
  isItemAccounted,
  progress
} = require('../../shared/assessment-v3-pilot/runtime-engine')

const SESSION_KEY = 'serious_match_assessment_v3_pilot'
const TASK_EVENT_TYPES = Object.freeze([
  'TASK_SHOWN',
  'ANSWERED',
  'ANSWER_CHANGED',
  'BACK',
  'SKIP',
  'BRANCH_ENTER',
  'BRANCH_EXIT',
  'ERROR',
  'COMPLETE'
])

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function now() { return Date.now() }

function createSeed(startedAt) {
  return `${BUNDLE.instrument.id}.${BUNDLE.instrument.version}.${startedAt}`
}

function emptySession(startedAt = now()) {
  const seed = createSeed(startedAt)
  const assignment = buildAssignment(seed, {})
  return {
    assessmentId: `${BUNDLE.instrument.id}.${startedAt}`,
    assessmentType: BUNDLE.instrument.id,
    instrumentVersion: BUNDLE.instrument.version,
    manifestVersion: BUNDLE.instrument.manifestVersion,
    status: 'draft_local',
    seed,
    assignment,
    currentParentIndex: 0,
    answers: {},
    answerEvents: [],
    missingness: {},
    taskEvents: [],
    startedAt,
    updatedAt: startedAt,
    completedAt: null
  }
}

function validSession(value) {
  return Boolean(
    value &&
    value.assessmentType === BUNDLE.instrument.id &&
    value.instrumentVersion === BUNDLE.instrument.version &&
    value.assignment &&
    Array.isArray(value.assignment.assignedParentTaskIds) &&
    value.answers &&
    typeof value.answers === 'object'
  )
}

function normalizeSession(value) {
  if (!validSession(value)) return emptySession()
  const session = Object.assign({
    answerEvents: [],
    missingness: {},
    taskEvents: [],
    currentParentIndex: 0,
    completedAt: null,
    updatedAt: now()
  }, value)
  if (!Array.isArray(session.answerEvents)) session.answerEvents = []
  if (!session.missingness || typeof session.missingness !== 'object') session.missingness = {}
  if (!Array.isArray(session.taskEvents)) session.taskEvents = []
  return session
}

function getSession() {
  return normalizeSession(wx.getStorageSync(SESSION_KEY))
}

function saveSession(session) {
  wx.setStorageSync(SESSION_KEY, session)
  return session
}

function resetSession() {
  wx.removeStorageSync(SESSION_KEY)
  return saveSession(emptySession())
}

function itemParentForAssignment(assignment, itemId) {
  return assignment.assignedParentTaskIds.find(parentId =>
    expectedItemIdsForParent(parentId).includes(itemId)
  ) || null
}

function responseTaskForItem(parentTaskId, itemId) {
  const parent = BUNDLE.tasks[parentTaskId]
  if (!parent) return null
  if (itemId === parentTaskId) return parent
  return (parent.children || []).find(child => child.itemId === itemId) || null
}

function taskMetadata(assignment, parentTaskId, itemId) {
  const parent = BUNDLE.tasks[parentTaskId]
  const item = responseTaskForItem(parentTaskId, itemId) || parent
  const freezeMeta = parent && parent.freezeMeta ? parent.freezeMeta : {}
  const branchPath = (assignment.earlyBranchIds || []).filter(branchId => {
    const branch = (BUNDLE.branches.early || []).find(candidate => candidate.id === branchId)
    return Boolean(branch && (branch.enable || []).includes(parentTaskId))
  })
  return {
    parentTaskId,
    itemId,
    itemVersion: (item && item.itemVersion) || (parent && parent.itemVersion) || BUNDLE.instrument.version,
    constructId: parent && parent.constructId,
    responseContext: (item && item.responseContext) || (parent && parent.responseContext) || 'SOURCE_UNSPECIFIED',
    researchForm: assignment.formKey,
    formId: assignment.formId,
    poolId: freezeMeta.p1Pool || null,
    branchPath
  }
}

function createTaskEvent(session, eventType, payload = {}, sequence = 0) {
  const timestamp = now()
  const parentTaskId = payload.parentTaskId || (payload.itemId ? itemParentForAssignment(session.assignment, payload.itemId) : null)
  return {
    eventId: `${eventType}.${timestamp}.${session.taskEvents.length + sequence + 1}`,
    eventType,
    parentTaskId,
    timestamp,
    payload: clone(payload)
  }
}

function appendTaskEvent(eventType, payload = {}) {
  if (!TASK_EVENT_TYPES.includes(eventType)) throw new Error(`任务事件类型无效: ${eventType}`)
  const session = getSession()
  return saveSession(Object.assign({}, session, {
    taskEvents: session.taskEvents.concat(createTaskEvent(session, eventType, payload)),
    updatedAt: now()
  }))
}

function rebuildEarlyBranches(session) {
  const oldAssignment = session.assignment
  const currentTaskId = oldAssignment.assignedParentTaskIds[session.currentParentIndex] || null
  const nextAssignment = buildAssignment(session.seed, session.answers)
  const nextIds = nextAssignment.assignedParentTaskIds
  const preservedIndex = currentTaskId ? nextIds.indexOf(currentTaskId) : -1
  const fallbackIndex = Math.min(session.currentParentIndex, Math.max(0, nextIds.length - 1))
  const next = Object.assign({}, session, {
    assignment: nextAssignment,
    currentParentIndex: preservedIndex >= 0 ? preservedIndex : fallbackIndex
  })
  const entered = nextAssignment.earlyBranchIds.filter(id => !oldAssignment.earlyBranchIds.includes(id))
  const exited = oldAssignment.earlyBranchIds.filter(id => !nextAssignment.earlyBranchIds.includes(id))
  const events = []
  entered.forEach((branchId, index) => {
    const branch = (BUNDLE.branches.early || []).find(candidate => candidate.id === branchId)
    events.push(createTaskEvent(next, 'BRANCH_ENTER', {
      parentTaskId: currentTaskId,
      branchId,
      taskIds: branch ? branch.enable || [] : []
    }, index))
  })
  exited.forEach((branchId, index) => {
    const branch = (BUNDLE.branches.early || []).find(candidate => candidate.id === branchId)
    events.push(createTaskEvent(next, 'BRANCH_EXIT', {
      parentTaskId: currentTaskId,
      branchId,
      taskIds: branch ? branch.enable || [] : []
    }, entered.length + index))
  })
  return Object.assign(next, { taskEvents: session.taskEvents.concat(events) })
}

function answerItem(itemId, rawValue) {
  const session = getSession()
  const parentTaskId = itemParentForAssignment(session.assignment, itemId)
  if (!parentTaskId) throw new Error(`回答 ${itemId} 不在当前 Pilot 分配中`)
  const check = validateItemResponse(itemId, rawValue)
  if (!check.ok) throw new Error(`回答 ${itemId} 无效: ${check.reason}`)
  const previous = [...session.answerEvents].reverse().find(e => e.itemId === itemId)
  const answeredAt = now()
  const metadata = taskMetadata(session.assignment, parentTaskId, itemId)
  const shownEvent = [...session.taskEvents].reverse().find(event =>
    event.eventType === 'TASK_SHOWN' && event.parentTaskId === parentTaskId
  )
  const event = {
    eventId: `${itemId}.${answeredAt}.${session.answerEvents.length + 1}`,
    ...metadata,
    rawValue: clone(rawValue),
    answeredAt,
    shownAt: shownEvent ? shownEvent.timestamp : null,
    responseTimeMs: shownEvent ? Math.max(0, answeredAt - shownEvent.timestamp) : null,
    answerChangeCount: previous ? (previous.answerChangeCount || 0) + 1 : 0,
    supersedesEventId: previous ? previous.eventId : null
  }
  const eventType = previous ? 'ANSWER_CHANGED' : 'ANSWERED'
  const nextMissingness = Object.assign({}, session.missingness)
  delete nextMissingness[itemId]
  let next = Object.assign({}, session, {
    answers: Object.assign({}, session.answers, { [itemId]: clone(rawValue) }),
    missingness: nextMissingness,
    answerEvents: session.answerEvents.concat(event),
    taskEvents: session.taskEvents.concat(createTaskEvent(session, eventType, metadata)),
    updatedAt: answeredAt
  })
  if (itemId === 'L5-CH01' || itemId === 'L5-CH02') next = rebuildEarlyBranches(next)
  return saveSession(next)
}

function markMissing(itemId, code) {
  const allowed = BUNDLE.missingnessCodes
  if (!allowed.includes(code)) throw new Error(`缺失代码无效: ${code}`)
  const session = getSession()
  const parentTaskId = itemParentForAssignment(session.assignment, itemId)
  if (!parentTaskId) throw new Error(`题目 ${itemId} 不在当前 Pilot 分配中`)
  if (Object.prototype.hasOwnProperty.call(session.answers, itemId)) throw new Error(`题目 ${itemId} 已有回答`)
  const updatedAt = now()
  const metadata = taskMetadata(session.assignment, parentTaskId, itemId)
  return saveSession(Object.assign({}, session, {
    missingness: Object.assign({}, session.missingness, { [itemId]: { code, updatedAt } }),
    taskEvents: session.taskEvents.concat(createTaskEvent(session, 'SKIP', Object.assign({}, metadata, { missingnessCode: code }))),
    updatedAt
  }))
}

function currentParentTaskId(session = getSession()) {
  return session.assignment.assignedParentTaskIds[session.currentParentIndex] || null
}

function setParentIndex(index) {
  const session = getSession()
  const max = Math.max(0, session.assignment.assignedParentTaskIds.length - 1)
  const bounded = Math.max(0, Math.min(Number(index) || 0, max))
  return saveSession(Object.assign({}, session, { currentParentIndex: bounded, updatedAt: now() }))
}

function goNext() {
  const session = getSession()
  const current = currentParentTaskId(session)
  if (!current) return session
  if (!isParentComplete(current, session.answers, session.missingness)) throw new Error('当前题目仍有未完成的回答')
  if (session.currentParentIndex >= session.assignment.assignedParentTaskIds.length - 1) return completeAssessment()
  return setParentIndex(session.currentParentIndex + 1)
}

function goPrevious() {
  const session = getSession()
  const current = currentParentTaskId(session)
  const next = setParentIndex(session.currentParentIndex - 1)
  return saveSession(Object.assign({}, next, {
    taskEvents: next.taskEvents.concat(createTaskEvent(next, 'BACK', { parentTaskId: current }))
  }))
}

function completeAssessment() {
  const session = getSession()
  if (session.status === 'completed_no_scoring') return session
  const incomplete = session.assignment.assignedParentTaskIds.filter(parentId =>
    !isParentComplete(parentId, session.answers, session.missingness)
  )
  if (incomplete.length) throw new Error(`仍有 ${incomplete.length} 个任务未完成`)
  const completedAt = now()
  return saveSession(Object.assign({}, session, {
    status: 'completed_no_scoring',
    completedAt,
    taskEvents: session.taskEvents.concat(createTaskEvent(session, 'COMPLETE', {
      status: 'completed_no_scoring',
      assignedParents: session.assignment.assignedParentTaskIds.length
    })),
    updatedAt: completedAt
  }))
}

function getProgress() {
  const session = getSession()
  return progress(session.assignment, session.answers, session.missingness)
}

module.exports = {
  SESSION_KEY,
  TASK_EVENT_TYPES,
  emptySession,
  validSession,
  getSession,
  saveSession,
  resetSession,
  answerItem,
  markMissing,
  appendTaskEvent,
  currentParentTaskId,
  setParentIndex,
  goNext,
  goPrevious,
  completeAssessment,
  getProgress,
  isItemAccounted,
  itemParentForAssignment
}
