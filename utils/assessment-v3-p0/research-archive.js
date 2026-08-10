const manifest = require('../../shared/assessment-v3-p0/generated/manifest.json')
const store = require('./session-store')

const ARCHIVE_KEY = 'serious_match_assessment_v3_p0_research_archive_v1'
const ARCHIVE_SCHEMA_VERSION = 'relationship_manual_v3_p0.research-archive.v1'
const memoryStorage = new Map()

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
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

function readArchive() {
  const value = storageGet(ARCHIVE_KEY)
  return Array.isArray(value) ? value.map(clone) : []
}

function writeArchive(entries) {
  storageSet(ARCHIVE_KEY, entries)
  return entries.map(clone)
}

function archiveEntry(session) {
  if (!store.validSession(session)) throw new Error('INVALID_P0_SESSION')
  if (session.status !== 'completed_no_scoring') throw new Error('P0_SESSION_NOT_COMPLETED')
  if (session.phone || session.phoneNumber || session.contact || session.name || session.displayName) throw new Error('P0_ARCHIVE_CONTAINS_PII_FIELD')
  return {
    sessionId: session.sessionId,
    participantStudyId: session.participantStudyId,
    waveId: session.waveId,
    instrumentVersion: session.instrumentVersion,
    relationshipContext: clone(session.relationshipContext),
    assignment: clone(session.assignment),
    currentTaskIndex: session.currentTaskIndex,
    latestAnswers: clone(session.latestAnswers),
    answerEvents: clone(session.answerEvents),
    missingness: clone(session.missingness),
    taskEvents: clone(session.taskEvents),
    interviewerCodingByItem: clone(session.interviewerCodingByItem),
    itemProbeNotes: clone(session.itemProbeNotes),
    waveDebrief: clone(session.waveDebrief),
    status: session.status,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt
  }
}

function appendCompletedSession(session = store.getSession()) {
  if (!session) throw new Error('NO_P0_SESSION')
  const entry = archiveEntry(session)
  const entries = readArchive()
  const existingBySession = entries.find(existing => existing.sessionId === entry.sessionId)
  if (existingBySession) {
    if (JSON.stringify(sortKeys(existingBySession)) !== JSON.stringify(sortKeys(entry))) throw new Error('ARCHIVE_SESSION_CONFLICT')
    return clone(existingBySession)
  }
  if (entries.some(existing => existing.participantStudyId === entry.participantStudyId)) throw new Error('PARTICIPANT_STUDY_ID_EXISTS')
  entries.push(entry)
  entries.sort((left, right) => left.sessionId.localeCompare(right.sessionId))
  writeArchive(entries)
  return clone(entry)
}

function completeAndArchiveSession(session = store.getSession()) {
  if (!session) throw new Error('NO_P0_SESSION')
  let completed = session
  const active = store.getSession()
  if (completed.status === 'in_progress') {
    if (!active || active.sessionId !== completed.sessionId) throw new Error('P0_ACTIVE_SESSION_MISMATCH')
    completed = store.completeSession()
  }
  const entry = appendCompletedSession(completed)
  const current = store.getSession()
  if (current && current.sessionId === completed.sessionId && current.status === 'completed_no_scoring') store.clearActiveSession()
  return clone(entry)
}

function listCompletedSessions(options = {}) {
  const waveId = typeof options === 'string'
    ? options
    : options && options.waveId ? String(options.waveId) : null
  return readArchive()
    .filter(entry => !waveId || entry.waveId === waveId)
    .sort((left, right) => left.sessionId.localeCompare(right.sessionId))
    .map(clone)
}

function deleteArchivedSession(sessionId) {
  const id = String(sessionId || '')
  const entries = readArchive()
  const next = entries.filter(entry => entry.sessionId !== id)
  if (next.length === entries.length) throw new Error('ARCHIVE_SESSION_NOT_FOUND')
  writeArchive(next)
  return true
}

function clearArchive() {
  storageRemove(ARCHIVE_KEY)
  return []
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortKeys(value[key])
    return result
  }, {})
}

function exportArchivePayload() {
  const sessions = listCompletedSessions()
  return sortKeys({
    exportSchemaVersion: ARCHIVE_SCHEMA_VERSION,
    instrumentId: manifest.instrumentId,
    instrumentVersion: manifest.instrumentVersion,
    scoring: 'NONE_IN_RUNTIME',
    manifest: {
      schemaVersion: manifest.schemaVersion,
      p0SpecVersion: manifest.p0SpecVersion,
      questionnaireFreezeVersion: manifest.questionnaireFreezeVersion,
      responseFormatVersion: manifest.responseFormatVersion,
      waveIds: manifest.waveIds,
      taskIdsByWave: manifest.taskIdsByWave,
      runtimeHash: manifest.runtimeHash
    },
    sessions
  })
}

function exportArchiveJson() {
  return JSON.stringify(exportArchivePayload())
}

module.exports = {
  ARCHIVE_KEY,
  ARCHIVE_SCHEMA_VERSION,
  archiveEntry,
  appendCompletedSession,
  appendSession: appendCompletedSession,
  completeAndArchiveSession,
  listCompletedSessions,
  listSessions: listCompletedSessions,
  filterCompletedSessions: listCompletedSessions,
  deleteArchivedSession,
  removeArchivedSession: deleteArchivedSession,
  clearArchive,
  exportArchivePayload,
  exportPayload: exportArchivePayload,
  exportArchiveJson,
  exportJson: exportArchiveJson,
  exportCompletedSessions: exportArchivePayload
}
