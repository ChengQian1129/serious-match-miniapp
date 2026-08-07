const assert = require('node:assert/strict')

global.wx = {
  getStorageSync() {},
  setStorageSync() {},
  removeStorageSync() {},
  getWindowInfo() { return { statusBarHeight: 20 } },
  showToast() {},
  redirectTo() {},
  navigateTo() {},
  reLaunch() {}
}

const store = require('../utils/assessment-v2/session-store')
const cloud = require('../utils/cloud')
let report = {
  reportVersion: 1,
  title: '本地关系说明书',
  subtitle: '等待云端补传',
  claims: [],
  unknowns: [],
  feedbackEvents: [],
  userConfirmations: {}
}
const session = { assessmentId: 'retry-test', status: 'report_generated' }
let completionCalls = 0

store.getReport = () => report
store.getSession = () => session
store.shouldSyncAssessment = () => true
store.replaceSession = value => value
store.replaceReport = value => { report = value; return value }
cloud.isCloudReady = () => true
cloud.completeAssessmentToCloud = (value, callbacks) => {
  completionCalls += 1
  assert.equal(value, session)
  if (completionCalls === 1) return callbacks.fail(new Error('network unavailable'))
  callbacks.success({
    session,
    report: Object.assign({}, report, { _id: 'cloud-report-1' })
  })
}

let definition
global.Page = value => { definition = value }
require('../pages/questionnaire-result/index.js')
const page = Object.assign({}, definition, {
  data: JSON.parse(JSON.stringify(definition.data)),
  setData(values) { Object.assign(this.data, values) }
})

page.onShow()
assert.equal(completionCalls, 1)
assert.equal(page.data.report._id, undefined)
page.onShow()
assert.equal(completionCalls, 2)
assert.equal(page.data.report._id, 'cloud-report-1')
page.onShow()
assert.equal(completionCalls, 2)

console.log('Questionnaire result sync OK: failed report uploads retry and stop after cloud success')
