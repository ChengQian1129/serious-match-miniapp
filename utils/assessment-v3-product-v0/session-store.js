const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const journey = require('./journey-model')

const SESSION_KEY = 'serious_match_assessment_v3_product_v0'
const REPORT_KEY = 'serious_match_report_v3_product_v0'

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function now() { return Date.now() }
function storageAvailable() { return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function' }

function boundedTaskIndex(value) {
  const max = Math.max(0, runtime.BUNDLE.orderedParentTaskIds.length - 1)
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(Math.floor(parsed), max))
}

function emptySession(startedAt = now()) { return runtime.createEmptySession(startedAt) }

function normalizeSession(value) {
  if (!value || value.assessmentType !== 'v3-product-v0' || !Array.isArray(value.answerEvents)) return emptySession()
  const answers = value.latestAnswers || value.answers || {}
  const missingness = value.missingness && typeof value.missingness === 'object' && !Array.isArray(value.missingness) ? value.missingness : {}
  return Object.assign(emptySession(value.startedAt || now()), clone(value), {
    latestAnswers: answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {},
    answers: answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {},
    missingness,
    currentTaskIndex: boundedTaskIndex(value.currentTaskIndex),
    taskEvents: Array.isArray(value.taskEvents) ? value.taskEvents : [],
    completedChapters: Array.isArray(value.completedChapters) ? value.completedChapters : [],
    reportRevision: Number(value.reportRevision) || 0
  })
}

function getSession() { return storageAvailable() ? normalizeSession(wx.getStorageSync(SESSION_KEY)) : emptySession() }
function saveSession(session) { if (storageAvailable()) wx.setStorageSync(SESSION_KEY, clone(session)); return session }
function hasSession() {
  const session = getSession()
  return Boolean(session.answerEvents.length || session.completedAt || session.status === 'synced' || session.status === 'completed')
}
function getReport() { return storageAvailable() ? wx.getStorageSync(REPORT_KEY) || null : null }
function saveReport(report) { if (storageAvailable()) wx.setStorageSync(REPORT_KEY, clone(report)); return report }
function clearReport() { if (storageAvailable()) wx.removeStorageSync(REPORT_KEY) }
function invalidateReport() { if (storageAvailable()) wx.removeStorageSync(REPORT_KEY) }
function resetSession() {
  if (storageAvailable()) {
    wx.removeStorageSync(SESSION_KEY)
    wx.removeStorageSync(REPORT_KEY)
  }
  return saveSession(emptySession())
}
function replaceSession(session) {
  const next = normalizeSession(session)
  return saveSession(next)
}
function replaceReport(report) {
  if (!report || report.source !== 'THEORY_DRIVEN_PRODUCT_V0') throw new Error('云端 Product v0 结果无效')
  return saveReport(report)
}
function markSynced(syncedAt = now()) {
  const session = getSession()
  return saveSession(Object.assign({}, session, { status: session.completedAt ? 'completed' : 'synced', syncedAt }))
}

function currentTaskId(session = getSession()) { return runtime.BUNDLE.orderedParentTaskIds[session.currentTaskIndex] || null }
function getTaskIndexById(taskId) { return journey.getTaskIndexById(taskId) }
function recordTaskEvent(session, type, payload) {
  return Object.assign({}, session, { taskEvents: (session.taskEvents || []).concat({ eventId: `${type}.${now()}.${(session.taskEvents || []).length + 1}`, eventType: type, timestamp: now(), payload: clone(payload || {}) }), updatedAt: now() })
}

function answerItem(itemId, rawValue) {
  const before = getSession()
  let next = runtime.answerItem(before, itemId, rawValue)
  next = Object.assign({}, recordTaskEvent(next, before.answerEvents.some(event => event.itemId === itemId) ? 'ANSWER_CHANGED' : 'ANSWERED', { itemId, taskId: runtime.getEntry(itemId).parent.taskId }), { status: 'pending_cloud' })
  if (before.completedAt) Object.assign(next, { completedAt: null, derivedProfile: null, derivedProfileVersion: null, reportVersion: null, reportRevision: Number(before.reportRevision) || Number(before.reportVersion) || 1 })
  invalidateReport()
  return saveSession(next)
}

function markMissing(itemId, code) {
  const before = getSession()
  const next = Object.assign({}, recordTaskEvent(runtime.markMissing(before, itemId, code), 'SKIP', { itemId, code }), { status: 'pending_cloud' })
  if (before.completedAt) Object.assign(next, { completedAt: null, derivedProfile: null, derivedProfileVersion: null, reportVersion: null, reportRevision: Number(before.reportRevision) || Number(before.reportVersion) || 1 })
  invalidateReport()
  return saveSession(next)
}

function isCurrentComplete(session = getSession()) {
  const taskId = currentTaskId(session); if (!taskId) return true
  return runtime.itemEntries(runtime.getTask(taskId)).every(entry => runtime.isAccounted(entry.itemId, session.latestAnswers || {}, session.missingness || {}))
}

function goNext() {
  const session = getSession()
  if (!isCurrentComplete(session)) throw new Error('请先完成这一题')
  const nextIndex = session.currentTaskIndex + 1
  if (nextIndex >= runtime.BUNDLE.orderedParentTaskIds.length) return completeAssessment()
  const next = Object.assign({}, session, { currentTaskIndex: nextIndex, updatedAt: now(), status: 'pending_cloud' })
  return saveSession(next)
}
function goPrevious() {
  const session = getSession()
  return saveSession(Object.assign({}, recordTaskEvent(session, 'BACK', { itemId: currentTaskId(session) }), { currentTaskIndex: Math.max(0, session.currentTaskIndex - 1), status: 'pending_cloud' }))
}
function setTaskIndex(index) {
  const session = getSession(); const bounded = boundedTaskIndex(index)
  return saveSession(Object.assign({}, session, { currentTaskIndex: bounded, updatedAt: now(), status: 'pending_cloud' }))
}
function setTaskId(taskId) {
  const index = getTaskIndexById(taskId)
  if (index < 0) return null
  return setTaskIndex(index)
}
function completeAssessment() {
  const before = getSession()
  const next = runtime.completeSession(before)
  const reportRevision = (Number(before.reportRevision) || Number(before.reportVersion) || 0) + 1
  next.reportRevision = reportRevision
  return saveSession(recordTaskEvent(next, 'COMPLETE', { status: next.status, reportRevision }))
}
function getProgress() { return runtime.progress(getSession()) }

module.exports = { SESSION_KEY, REPORT_KEY, emptySession, normalizeSession, getSession, hasSession, getReport, saveReport, clearReport, replaceSession, replaceReport, markSynced, saveSession, resetSession, currentTaskId, getTaskIndexById, setTaskId, answerItem, markMissing, isCurrentComplete, goNext, goPrevious, setTaskIndex, completeAssessment, getProgress, isAssessmentComplete: journey.isAssessmentComplete }
