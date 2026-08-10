const engine = require('../../shared/assessment-v3-p0/runtime-engine')

const SESSION_KEY = 'serious_match_assessment_v3_p0_research'
const TASK_EVENT_TYPES = Object.freeze([
  'SHOWN',
  'TASK_SHOWN',
  'ANSWERED',
  'ANSWER_CHANGED',
  'BACK',
  'SKIP',
  'ERROR',
  'CODING_SAVED',
  'PROBE_NOTES_SAVED',
  'RESEARCH_READY_FOR_DEBRIEF',
  'DEBRIEF_SAVED',
  'COMPLETE'
])

const memoryStorage = new Map()

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function now() {
  return Date.now()
}

function storageGet(key) {
  if (typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function') return wx.getStorageSync(key)
  return memoryStorage.get(key)
}

function storageSet(key, value) {
  if (typeof wx !== 'undefined' && wx && typeof wx.setStorageSync === 'function') wx.setStorageSync(key, clone(value))
  else memoryStorage.set(key, clone(value))
}

function storageRemove(key) {
  if (typeof wx !== 'undefined' && wx && typeof wx.removeStorageSync === 'function') wx.removeStorageSync(key)
  else memoryStorage.delete(key)
}

function createSessionId(waveId, participantStudyId, startedAt) {
  return `${engine.BUNDLE.instrument.id}.${waveId}.${participantStudyId}.${startedAt}`
}

function emptySession(options = {}) {
  if (typeof options === 'string') {
    options = {
      waveId: options,
      participantStudyId: arguments[1],
      relationshipContext: arguments[2],
      startedAt: arguments[3]
    }
  }
  const startedAt = Number(options.startedAt || now())
  const waveId = String(options.waveId || '')
  const participant = engine.validateParticipantStudyId(options.participantStudyId)
  if (!participant.ok) throw new Error(participant.reason)
  const context = engine.validateRelationshipContext(options.relationshipContext)
  if (!context.ok) throw new Error(`${context.reason}:${context.missing.join(',')}`)
  const assignment = engine.buildWaveAssignment(waveId)
  const participantStudyId = participant.value
  const answers = {}
  return {
    sessionId: options.sessionId || createSessionId(waveId, participantStudyId, startedAt),
    participantStudyId,
    waveId,
    instrumentVersion: engine.BUNDLE.instrument.version,
    relationshipContext: context.value,
    assignment,
    currentTaskIndex: 0,
    latestAnswers: answers,
    answers,
    answerEvents: [],
    missingness: {},
    taskEvents: [],
    interviewerCodingByItem: {},
    itemProbeNotes: {},
    waveDebrief: null,
    status: 'in_progress',
    startedAt,
    updatedAt: startedAt,
    completedAt: null
  }
}

function allAssignedItemIds(session) {
  const result = []
  session.assignment.assignedParentTaskIds.forEach(parentTaskId => {
    engine.expectedItemIdsForParent(parentTaskId).forEach(itemId => result.push(itemId))
  })
  return result
}

function validSession(value) {
  if (!value || typeof value !== 'object') return false
  if (value.instrumentVersion !== engine.BUNDLE.instrument.version) return false
  if (!value.sessionId || !value.participantStudyId || !engine.WAVE_IDS.includes(value.waveId)) return false
  if (!value.assignment || value.assignment.waveId !== value.waveId) return false
  if (!Array.isArray(value.assignment.assignedParentTaskIds)) return false
  if (!value.latestAnswers || typeof value.latestAnswers !== 'object') return false
  if (!value.answers || typeof value.answers !== 'object') return false
  if (value.phone || value.phoneNumber || value.contact || value.name || value.displayName) return false
  return value.assignment.assignedParentTaskIds.join('|') === engine.buildWaveAssignment(value.waveId).assignedParentTaskIds.join('|')
}

function normalizeSession(value) {
  if (!value) return null
  if (!validSession(value)) return null
  const session = clone(value)
  session.answerEvents = Array.isArray(session.answerEvents) ? session.answerEvents : []
  session.taskEvents = Array.isArray(session.taskEvents) ? session.taskEvents : []
  session.missingness = session.missingness && typeof session.missingness === 'object' ? session.missingness : {}
  session.interviewerCodingByItem = session.interviewerCodingByItem && typeof session.interviewerCodingByItem === 'object' ? session.interviewerCodingByItem : {}
  session.itemProbeNotes = session.itemProbeNotes && typeof session.itemProbeNotes === 'object' ? session.itemProbeNotes : {}
  session.currentTaskIndex = Math.max(0, Math.min(Number(session.currentTaskIndex) || 0, session.assignment.assignedParentTaskIds.length - 1))
  session.status = session.status || 'in_progress'
  session.completedAt = session.completedAt || null
  session.answers = clone(session.latestAnswers)
  return session
}

function assertAnswerEventsAppendOnly(previous, next) {
  if (!previous) return
  if (next.answerEvents.length < previous.answerEvents.length) throw new Error('ANSWER_EVENTS_APPEND_ONLY')
  for (let index = 0; index < previous.answerEvents.length; index += 1) {
    if (JSON.stringify(previous.answerEvents[index]) !== JSON.stringify(next.answerEvents[index])) throw new Error('ANSWER_EVENTS_APPEND_ONLY')
  }
  const eventIds = new Set()
  const latestByItem = {}
  next.answerEvents.forEach(event => {
    if (!event || !event.eventId || !event.itemId || eventIds.has(event.eventId)) throw new Error('INVALID_ANSWER_EVENT_CHAIN')
    eventIds.add(event.eventId)
    if (event.supersedesEventId && !eventIds.has(event.supersedesEventId)) throw new Error('INVALID_ANSWER_EVENT_CHAIN')
    latestByItem[event.itemId] = clone(event.rawValue)
  })
  if (JSON.stringify(latestByItem) !== JSON.stringify(next.latestAnswers)) throw new Error('ANSWER_LEDGER_MISMATCH')
}

function getSession() {
  return normalizeSession(storageGet(SESSION_KEY))
}

function saveSession(session) {
  if (!validSession(session)) throw new Error('INVALID_P0_SESSION')
  const normalized = normalizeSession(session)
  const previous = normalizeSession(storageGet(SESSION_KEY))
  assertAnswerEventsAppendOnly(previous, normalized)
  storageSet(SESSION_KEY, normalized)
  return clone(normalized)
}

function startSession(options) {
  const session = emptySession(options)
  return saveSession(session)
}

function resetSession() {
  storageRemove(SESSION_KEY)
  return null
}

function requireSession() {
  const session = getSession()
  if (!session) throw new Error('NO_P0_SESSION')
  return session
}

function requireActiveSession() {
  const session = requireSession()
  if (session.status !== 'in_progress') throw new Error('P0_SESSION_NOT_ACTIVE')
  return session
}

function parentForItem(session, itemId) {
  const parentTaskId = engine.itemParentForWave(session.waveId, itemId)
  if (!parentTaskId || !session.assignment.assignedParentTaskIds.includes(parentTaskId)) return null
  return parentTaskId
}

function eventId(session, eventType, timestamp) {
  return `${eventType}.${timestamp}.${session.taskEvents.length + 1}`
}

function appendEvent(session, eventType, payload = {}, timestamp = now()) {
  if (!TASK_EVENT_TYPES.includes(eventType)) throw new Error(`UNKNOWN_TASK_EVENT:${eventType}`)
  const event = {
    eventId: eventId(session, eventType, timestamp),
    eventType,
    parentTaskId: payload.parentTaskId || null,
    timestamp,
    payload: clone(payload)
  }
  return session.taskEvents.concat(event)
}

function appendTaskEvent(eventType, payload = {}) {
  const session = requireActiveSession()
  const updatedAt = now()
  return saveSession(Object.assign({}, session, {
    taskEvents: appendEvent(session, eventType, payload, updatedAt),
    updatedAt
  }))
}

function currentTaskId(session = requireSession()) {
  return session.assignment.assignedParentTaskIds[session.currentTaskIndex] || null
}

function setTaskIndex(index) {
  const session = requireActiveSession()
  const max = Math.max(0, session.assignment.assignedParentTaskIds.length - 1)
  const bounded = Math.max(0, Math.min(Number(index) || 0, max))
  return saveSession(Object.assign({}, session, { currentTaskIndex: bounded, updatedAt: now() }))
}

function recordTaskShown(parentTaskId) {
  const session = requireActiveSession()
  if (!session.assignment.assignedParentTaskIds.includes(parentTaskId)) throw new Error('ITEM_NOT_ASSIGNED')
  const updatedAt = now()
  const itemIds = engine.expectedItemIdsForParent(parentTaskId)
  return saveSession(Object.assign({}, session, {
    taskEvents: appendEvent(session, 'SHOWN', { parentTaskId, itemIds }, updatedAt),
    updatedAt
  }))
}

function answerItem(itemId, rawValue) {
  const session = requireActiveSession()
  const parentTaskId = parentForItem(session, itemId)
  if (!parentTaskId) throw new Error('ITEM_NOT_ASSIGNED')
  const check = engine.validateItemResponse(itemId, rawValue)
  if (!check.ok) throw new Error(check.reason)
  const resolved = engine.getTaskForItem(itemId)
  const timestamp = now()
  const previous = [...session.answerEvents].reverse().find(event => event.itemId === itemId)
  const shownEvent = [...session.taskEvents].reverse().find(event => (event.eventType === 'SHOWN' || event.eventType === 'TASK_SHOWN') && event.parentTaskId === parentTaskId)
  const answerEvent = {
    eventId: `${itemId}.${timestamp}.${session.answerEvents.length + 1}`,
    parentTaskId,
    itemId,
    itemVersion: resolved.item.itemVersion || resolved.parent.itemVersion || engine.BUNDLE.instrument.version,
    constructId: resolved.parent.constructId,
    responseContext: resolved.item.responseContext || resolved.parent.responseContext || null,
    contextBasis: session.relationshipContext.responseContextForRelationshipItems,
    rawValue: clone(rawValue),
    responseStage: 'silent_first',
    answeredAt: timestamp,
    shownAt: shownEvent ? shownEvent.timestamp : null,
    responseTimeMs: shownEvent ? Math.max(0, timestamp - shownEvent.timestamp) : null,
    answerChangeCount: previous ? (previous.answerChangeCount || 0) + 1 : 0,
    supersedesEventId: previous ? previous.eventId : null
  }
  const latestAnswers = Object.assign({}, session.latestAnswers, { [itemId]: clone(rawValue) })
  const missingness = Object.assign({}, session.missingness)
  delete missingness[itemId]
  const eventType = previous ? 'ANSWER_CHANGED' : 'ANSWERED'
  const next = Object.assign({}, session, {
    latestAnswers,
    answers: latestAnswers,
    missingness,
    answerEvents: session.answerEvents.concat(answerEvent),
    taskEvents: appendEvent(session, eventType, { parentTaskId, itemId }, timestamp),
    updatedAt: timestamp
  })
  return saveSession(next)
}

function markMissing(itemId, code) {
  const session = requireActiveSession()
  const parentTaskId = parentForItem(session, itemId)
  if (!parentTaskId) throw new Error('ITEM_NOT_ASSIGNED')
  if (!engine.validateMissingnessCode(code)) throw new Error('INVALID_MISSINGNESS_CODE')
  if (Object.prototype.hasOwnProperty.call(session.latestAnswers, itemId)) throw new Error('ITEM_ALREADY_ANSWERED')
  const updatedAt = now()
  return saveSession(Object.assign({}, session, {
    missingness: Object.assign({}, session.missingness, { [itemId]: { code: String(code), updatedAt } }),
    taskEvents: appendEvent(session, 'SKIP', { parentTaskId, itemId, missingnessCode: String(code) }, updatedAt),
    updatedAt
  }))
}

function isItemAccounted(session, itemId) {
  return engine.isItemAccounted(itemId, session.latestAnswers, session.missingness)
}

function getProgress() {
  const session = requireSession()
  return engine.progress(session.assignment, session.latestAnswers, session.missingness)
}

function goNext() {
  const session = requireActiveSession()
  const current = currentTaskId(session)
  if (!current) throw new Error('NO_CURRENT_TASK')
  if (!engine.isParentComplete(current, session.latestAnswers, session.missingness)) throw new Error('CURRENT_TASK_INCOMPLETE')
  if (session.currentTaskIndex >= session.assignment.assignedParentTaskIds.length - 1) {
    const updatedAt = now()
    return saveSession(Object.assign({}, session, {
      taskEvents: appendEvent(session, 'RESEARCH_READY_FOR_DEBRIEF', { parentTaskId: current }, updatedAt),
      updatedAt
    }))
  }
  return saveSession(Object.assign({}, session, {
    currentTaskIndex: session.currentTaskIndex + 1,
    updatedAt: now()
  }))
}

function goPrevious() {
  const session = requireActiveSession()
  const current = currentTaskId(session)
  const nextIndex = Math.max(0, session.currentTaskIndex - 1)
  const updatedAt = now()
  return saveSession(Object.assign({}, session, {
    currentTaskIndex: nextIndex,
    taskEvents: appendEvent(session, 'BACK', { parentTaskId: current, toIndex: nextIndex }, updatedAt),
    updatedAt
  }))
}

function ensureAssignedItem(session, itemId) {
  const parentTaskId = parentForItem(session, itemId)
  if (!parentTaskId) throw new Error('ITEM_NOT_ASSIGNED')
  if (!isItemAccounted(session, itemId)) throw new Error('SILENT_RESPONSE_REQUIRED')
  return parentTaskId
}

function validateEnum(field, value) {
  if (value === undefined || value === null || value === '') return false
  return (engine.BUNDLE.codingSchema[field] || []).includes(String(value))
}

function validateCoding(coding) {
  const value = coding && typeof coding === 'object' ? coding : {}
  Object.keys(engine.BUNDLE.codingSchema).forEach(field => {
    if (!validateEnum(field, value[field])) throw new Error(`INVALID_CODING:${field}`)
  })
  const contamination = value.constructContamination
  if (!contamination || !Array.isArray(contamination.suspected) || contamination.suspected.some(item => typeof item !== 'string')) {
    throw new Error('INVALID_CODING:constructContamination')
  }
  return {
    comprehension: String(value.comprehension),
    retrievalBasis: String(value.retrievalBasis),
    responseMapping: String(value.responseMapping),
    socialDesirability: String(value.socialDesirability),
    emotionalSensitivity: String(value.emotionalSensitivity),
    constructContamination: { suspected: contamination.suspected.map(item => item.trim()).filter(Boolean) },
    recommendedAction: String(value.recommendedAction)
  }
}

function normalizeNote(value, maxChars = 2000) {
  if (value === undefined || value === null) return ''
  const text = String(value)
  if (text.length > maxChars) throw new Error(`NOTE_TOO_LONG:${maxChars}`)
  return text
}

function saveItemCoding(itemId, coding, notes = {}) {
  const session = requireActiveSession()
  const parentTaskId = ensureAssignedItem(session, itemId)
  const normalizedCoding = validateCoding(coding)
  const updatedAt = now()
  const normalizedNotes = {
    interviewerNote: normalizeNote(notes.interviewerNote !== undefined ? notes.interviewerNote : notes.note),
    missingOptionNote: normalizeNote(notes.missingOptionNote),
    paraphraseNote: normalizeNote(notes.paraphraseNote !== undefined ? notes.paraphraseNote : notes.termNote),
    updatedAt
  }
  return saveSession(Object.assign({}, session, {
    interviewerCodingByItem: Object.assign({}, session.interviewerCodingByItem, {
      [itemId]: Object.assign({ itemId, parentTaskId }, normalizedCoding, { updatedAt })
    }),
    itemProbeNotes: Object.assign({}, session.itemProbeNotes, { [itemId]: normalizedNotes }),
    taskEvents: appendEvent(session, 'CODING_SAVED', { parentTaskId, itemId }, updatedAt),
    updatedAt
  }))
}

function saveItemProbeNotes(itemId, notes = {}) {
  const session = requireActiveSession()
  const parentTaskId = ensureAssignedItem(session, itemId)
  const updatedAt = now()
  const normalizedNotes = {
    interviewerNote: normalizeNote(notes.interviewerNote !== undefined ? notes.interviewerNote : notes.note),
    missingOptionNote: normalizeNote(notes.missingOptionNote),
    paraphraseNote: normalizeNote(notes.paraphraseNote !== undefined ? notes.paraphraseNote : notes.termNote),
    updatedAt
  }
  return saveSession(Object.assign({}, session, {
    itemProbeNotes: Object.assign({}, session.itemProbeNotes, { [itemId]: normalizedNotes }),
    taskEvents: appendEvent(session, 'PROBE_NOTES_SAVED', { parentTaskId, itemId }, updatedAt),
    updatedAt
  }))
}

function validateItemSelector(session, itemId) {
  if (itemId === null || itemId === undefined || itemId === '') return null
  const value = String(itemId)
  if (!allAssignedItemIds(session).includes(value)) throw new Error(`INVALID_DEBRIEF_ITEM:${value}`)
  return value
}

function normalizeItemIds(session, values) {
  if (!Array.isArray(values)) throw new Error('INVALID_DEBRIEF_ITEM_LIST')
  const normalized = values.map(value => validateItemSelector(session, value)).filter(Boolean)
  if (new Set(normalized).size !== normalized.length) throw new Error('DUPLICATE_DEBRIEF_ITEM')
  return normalized
}

function saveWaveDebrief(debrief) {
  const session = requireActiveSession()
  const value = debrief && typeof debrief === 'object' ? debrief : {}
  const normalized = {
    hardestItemIds: normalizeItemIds(session, value.hardestItemIds || []),
    repetitiveItemIds: normalizeItemIds(session, value.repetitiveItemIds || []),
    correctAnswerFeelingItemId: validateItemSelector(session, value.correctAnswerFeelingItemId !== undefined ? value.correctAnswerFeelingItemId : value.strongestCorrectAnswerItemId),
    strongestCorrectAnswerItemId: validateItemSelector(session, value.strongestCorrectAnswerItemId !== undefined ? value.strongestCorrectAnswerItemId : value.correctAnswerFeelingItemId),
    importantUnaskedNote: normalizeNote(value.importantUnaskedNote),
    askedTooEarlyItemId: validateItemSelector(session, value.askedTooEarlyItemId),
    privacySensitiveItemId: validateItemSelector(session, value.privacySensitiveItemId),
    privateInterviewNote: normalizeNote(value.privateInterviewNote),
    updatedAt: now()
  }
  return saveSession(Object.assign({}, session, {
    waveDebrief: normalized,
    taskEvents: appendEvent(session, 'DEBRIEF_SAVED', {}, normalized.updatedAt),
    updatedAt: normalized.updatedAt
  }))
}

function completeSession() {
  const session = requireActiveSession()
  const incomplete = session.assignment.assignedParentTaskIds.filter(parentTaskId =>
    !engine.isParentComplete(parentTaskId, session.latestAnswers, session.missingness)
  )
  if (incomplete.length) throw new Error(`INCOMPLETE_TASKS:${incomplete.join(',')}`)
  if (!session.waveDebrief) throw new Error('DEBRIEF_REQUIRED')
  if (!session.waveDebrief.correctAnswerFeelingItemId) throw new Error('DEBRIEF_INCOMPLETE')
  const codingMissing = Object.keys(session.latestAnswers).filter(itemId => !session.interviewerCodingByItem[itemId])
  if (codingMissing.length) throw new Error(`CODING_REQUIRED:${codingMissing.join(',')}`)
  const completedAt = now()
  return saveSession(Object.assign({}, session, {
    status: 'completed_no_scoring',
    completedAt,
    updatedAt: completedAt,
    taskEvents: appendEvent(session, 'COMPLETE', { status: 'completed_no_scoring', waveId: session.waveId }, completedAt)
  }))
}

module.exports = {
  SESSION_KEY,
  TASK_EVENT_TYPES,
  emptySession,
  createSession: emptySession,
  startSession,
  validSession,
  getSession,
  saveSession,
  resetSession,
  currentTaskId,
  setTaskIndex,
  recordTaskShown,
  appendTaskEvent,
  answerItem,
  markMissing,
  isItemAccounted,
  getProgress,
  goNext,
  goPrevious,
  saveItemCoding,
  recordItemCoding: saveItemCoding,
  saveCoding: saveItemCoding,
  saveItemProbeNotes,
  recordProbeNotes: saveItemProbeNotes,
  validateCoding,
  saveWaveDebrief,
  saveDebrief: saveWaveDebrief,
  completeSession,
  completeInterview: completeSession,
  allAssignedItemIds
}
