const assert = require('node:assert/strict')
const Module = require('node:module')

const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) }
}
const store = require('../utils/assessment-v2/session-store')
const { ITEMS } = require('../utils/assessment-v2/questionnaire-definitions')
const reportEngine = require('../utils/assessment-v2/report-engine')
const report = Object.assign({ _id: 'feedback-report' }, reportEngine.buildReport(Object.fromEntries(ITEMS.map(item => [item.id, item.reverseScored ? 1 : 5]))))
storage.set(store.REPORT_KEY, report)
storage.set(store.STORAGE_CHOICE_KEY, { choice: 'cloud' })
const first = store.saveClaimFeedback(report.claims[0].id, 'partly_fits', '第一次核对')
const second = store.saveClaimFeedback(report.claims[0].id, 'fits', '补充经历')
assert.notEqual(first.eventId, second.eventId)
assert.equal(second.supersedesFeedbackId, first.eventId)
assert.equal(store.getReport().feedbackEvents.length, 2)
assert.equal(store.getReport().userConfirmations[report.claims[0].id].value, 'fits')
store.markFeedbackEventSynced(second.eventId)
assert.equal(store.getReport().feedbackEvents.find(event => event.eventId === second.eventId).pendingCloud, false)
assert.equal(store.getReport().feedbackEvents.find(event => event.eventId === first.eventId).pendingCloud, true)
console.log('Feedback events OK: revisions append without overwriting history')
