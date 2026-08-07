const assert = require('node:assert/strict')

global.wx = {
  getStorageSync() {},
  setStorageSync() {},
  removeStorageSync() {},
  getWindowInfo() { return { statusBarHeight: 20 } },
  pageScrollTo() {},
  nextTick(callback) { callback() },
  navigateTo() {},
  redirectTo() {},
  navigateBack() {},
  reLaunch() {}
}

const store = require('../utils/assessment-v2/session-store')
const cloud = require('../utils/cloud')
const session = { assessmentType: 'relationship_manual_v2', status: 'pending_cloud', answers: {}, currentChapterId: 'C1', currentItemIndex: 0 }
let saveCalls = 0
store.getSession = () => session
store.shouldSyncAssessment = () => true
store.markSynced = () => { session.status = 'synced'; return session }
cloud.saveAssessmentDraftToCloud = (value, callbacks) => {
  saveCalls += 1
  assert.equal(value, session)
  if (saveCalls === 1) return callbacks.fail(new Error('network unavailable'))
  callbacks.success({ session })
}

let definition
global.Page = value => { definition = value }
require('../pages/questionnaire/index.js')
const page = Object.assign({}, definition, {
  data: JSON.parse(JSON.stringify(definition.data)),
  setData(values, callback) { Object.assign(this.data, values); if (callback) callback() }
})

page.onShow()
assert.equal(saveCalls, 1)
assert.equal(session.status, 'pending_cloud')
page.onShow()
assert.equal(saveCalls, 2)
assert.equal(session.status, 'synced')

console.log('Questionnaire draft retry OK: failed drafts retry on re-entry')
