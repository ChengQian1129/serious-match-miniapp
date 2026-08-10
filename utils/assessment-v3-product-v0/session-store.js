const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')

const SESSION_KEY = 'serious_match_assessment_v3_product_v0'

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function now() { return Date.now() }
function storageAvailable() { return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function' }

function emptySession(startedAt = now()) { return runtime.createEmptySession(startedAt) }

function normalizeSession(value) {
  if (!value || value.assessmentType !== 'v3-product-v0' || !Array.isArray(value.answerEvents)) return emptySession()
  return Object.assign(emptySession(value.startedAt || now()), clone(value), {
    latestAnswers: value.latestAnswers || value.answers || {},
    answers: value.latestAnswers || value.answers || {},
    missingness: value.missingness || {},
    taskEvents: Array.isArray(value.taskEvents) ? value.taskEvents : [],
    completedChapters: Array.isArray(value.completedChapters) ? value.completedChapters : []
  })
}

function getSession() { return storageAvailable() ? normalizeSession(wx.getStorageSync(SESSION_KEY)) : emptySession() }
function saveSession(session) { if (storageAvailable()) wx.setStorageSync(SESSION_KEY, clone(session)); return session }
function resetSession() { if (storageAvailable()) wx.removeStorageSync(SESSION_KEY); return saveSession(emptySession()) }

function currentTaskId(session = getSession()) { return runtime.BUNDLE.orderedParentTaskIds[session.currentTaskIndex] || null }
function recordTaskEvent(session, type, payload) {
  return Object.assign({}, session, { taskEvents: (session.taskEvents || []).concat({ eventId: `${type}.${now()}.${(session.taskEvents || []).length + 1}`, eventType: type, timestamp: now(), payload: clone(payload || {}) }), updatedAt: now() })
}

function answerItem(itemId, rawValue) {
  const before = getSession()
  let next = runtime.answerItem(before, itemId, rawValue)
  next = recordTaskEvent(next, before.answerEvents.some(event => event.itemId === itemId) ? 'ANSWER_CHANGED' : 'ANSWERED', { itemId, taskId: runtime.getEntry(itemId).parent.taskId })
  return saveSession(next)
}

function markMissing(itemId, code) {
  const next = recordTaskEvent(runtime.markMissing(getSession(), itemId, code), 'SKIP', { itemId, code })
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
  const next = Object.assign({}, session, { currentTaskIndex: nextIndex, updatedAt: now() })
  return saveSession(next)
}
function goPrevious() {
  const session = getSession()
  return saveSession(Object.assign({}, recordTaskEvent(session, 'BACK', { itemId: currentTaskId(session) }), { currentTaskIndex: Math.max(0, session.currentTaskIndex - 1) }))
}
function setTaskIndex(index) {
  const session = getSession(); const bounded = Math.max(0, Math.min(Number(index) || 0, runtime.BUNDLE.orderedParentTaskIds.length - 1))
  return saveSession(Object.assign({}, session, { currentTaskIndex: bounded, updatedAt: now() }))
}
function completeAssessment() {
  const next = runtime.completeSession(getSession())
  return saveSession(recordTaskEvent(next, 'COMPLETE', { status: next.status }))
}
function getProgress() { return runtime.progress(getSession()) }

module.exports = { SESSION_KEY, emptySession, normalizeSession, getSession, saveSession, resetSession, currentTaskId, answerItem, markMissing, isCurrentComplete, goNext, goPrevious, setTaskIndex, completeAssessment, getProgress }
