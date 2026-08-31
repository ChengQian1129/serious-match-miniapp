const assert = require('node:assert/strict')
const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) },
  showToast() {},
  navigateTo() {},
  redirectTo(options) { lastNavigation = options },
  navigateBack() {},
  reLaunch() {}
}
let lastNavigation = null
let definition
global.Page = value => { definition = value }
const pageHelpers = require('../pages/questionnaire-v3/index')
const page = definition
const store = require('../utils/assessment-v3-product-v0/session-store')
const runtime = require('../shared/assessment-v3-product-v0/runtime-engine')
const cloud = require('../utils/cloud')

const session = store.emptySession(123)
assert.equal(store.normalizeSession(Object.assign({}, session, { currentTaskIndex: 999 })).currentTaskIndex, runtime.BUNDLE.orderedParentTaskIds.length - 1)
assert.equal(store.normalizeSession(Object.assign({}, session, { currentTaskIndex: 'not-a-number' })).currentTaskIndex, 0)
assert.deepEqual(store.normalizeSession(Object.assign({}, session, { missingness: [] })).missingness, {})
const state = pageHelpers.pageState(session)
assert.equal(state.taskId, 'RR01')
assert.equal(state.chapter, 'C1')
assert.equal(state.chapterNumber, 1)
assert.equal(state.sectionNumber, 1)
assert.equal(state.sectionCount, 10)
assert.equal(state.progressLabel, '第 1 / 10 部分')
assert.ok(state.items.length)
assert.equal(state.canContinue, false)
assert.equal(state.showIntro, true)
assert.equal(pageHelpers.pageState(Object.assign({}, session, { currentTaskIndex: 1 })).showIntro, false)
assert.equal(pageHelpers.progressPercentLabel(1 / 266), '<1%')
assert.ok(pageHelpers.progressWidth(1 / 266).startsWith('0.'))
const task = runtime.getTask('SN-S01')
assert.equal(pageHelpers.buildItems(task, session).length, 2)
assert.equal(pageHelpers.chapterIndex('C6'), 5)

const inputEntry = runtime.BUNDLE.orderedParentTaskIds.flatMap(taskId => runtime.itemEntries(runtime.getTask(taskId))).find(entry => {
  const format = runtime.resolveFormat(entry.item.response)
  return format && (format.type === 'free_text' || format.allowBlank)
})
const inputIndex = runtime.BUNDLE.orderedParentTaskIds.indexOf(inputEntry.parent.taskId)
store.setTaskIndex(inputIndex)
page.setData = function setData(update) {
  const next = Object.assign({}, this.data)
  Object.entries(update).forEach(([key, value]) => {
    const match = key.match(/^items\[(\d+)\]\.value$/)
    if (match) {
      next.items = next.items.slice()
      next.items[Number(match[1])] = Object.assign({}, next.items[Number(match[1])], { value })
    } else next[key] = value
  })
  this.data = next
}
page.onLoad({ index: inputIndex })
const inputFormat = runtime.resolveFormat(inputEntry.item.response)
const inputValue = inputFormat.type === 'number' ? String(inputFormat.validation && inputFormat.validation.min !== undefined ? inputFormat.validation.min : inputFormat.options[0].code) : '页面失焦后才保存'
page.handleInput({ currentTarget: { dataset: { itemId: inputEntry.itemId } }, detail: { value: inputValue } })
assert.equal(store.getSession().answerEvents.length, 0)
assert.equal(page.data.items.find(item => item.itemId === inputEntry.itemId).value, inputValue)
page.handleInputBlur({ currentTarget: { dataset: { itemId: inputEntry.itemId } } })
assert.equal(store.getSession().answerEvents.length, 1)
assert.equal(store.getSession().latestAnswers[inputEntry.itemId], inputValue)
page.handleInput({ currentTarget: { dataset: { itemId: inputEntry.itemId } }, detail: { value: '' } })
page.handleInputBlur({ currentTarget: { dataset: { itemId: inputEntry.itemId } } })
assert.equal(store.getSession().latestAnswers[inputEntry.itemId], undefined)
assert.equal(store.getSession().missingness[inputEntry.itemId].code, 'NOT_SURE')

const completed = Object.assign(store.emptySession(456), { status: 'completed', completedAt: 789, derivedProfile: { source: 'THEORY_DRIVEN_PRODUCT_V0' } })
store.saveSession(completed)
store.saveReport({ source: 'THEORY_DRIVEN_PRODUCT_V0', title: '本地结果' })
store.answerItem('RR01', runtime.resolveFormat(runtime.getEntry('RR01').item.response).options[0].code)
assert.equal(store.getSession().completedAt, null)
assert.equal(store.getReport(), null)

let full = runtime.createEmptySession(1000)
let timestamp = 2000
runtime.BUNDLE.orderedParentTaskIds.forEach(taskId => {
  runtime.itemEntries(runtime.getTask(taskId)).forEach(entry => {
    const format = runtime.resolveFormat(entry.item.response)
    let value
    if (format.type === 'single_select') value = format.options[0].code
    else if (format.type === 'multi_select') value = format.options.slice(0, format.validation && format.validation.minSelections || 1).map(option => option.code)
    else if (format.type === 'number') value = String(format.validation && format.validation.min !== undefined ? format.validation.min : 1)
    else value = '页面完成测试'
    full = runtime.answerItem(full, entry.itemId, value, timestamp)
    timestamp += 1
  })
})
full.currentTaskIndex = runtime.BUNDLE.orderedParentTaskIds.length - 1
store.saveSession(full)
page.onLoad({ index: full.currentTaskIndex })
page.handleContinue()
assert.equal(lastNavigation.url, '/pages/v3-result/index?mode=product-v0')

const originalCloudReady = cloud.isCloudReady
const originalSaveDraft = cloud.saveProductV0DraftToCloud
let syncCalls = []
let pendingSync
cloud.isCloudReady = () => true
cloud.saveProductV0DraftToCloud = (requested, callbacks) => { syncCalls.push(requested); pendingSync = callbacks }
let draft = runtime.createEmptySession(3000)
draft = runtime.answerItem(draft, 'RR01', runtime.resolveFormat(runtime.getEntry('RR01').item.response).options[0].code, 3010)
store.saveSession(draft)
page._cloudSyncing = false
page.syncPending()
assert.equal(syncCalls.length, 1)
const newerDraft = Object.assign({}, store.getSession(), { currentTaskIndex: 1, status: 'pending_cloud', updatedAt: 3011 })
store.saveSession(newerDraft)
pendingSync.success({ session: Object.assign({}, syncCalls[0], { status: 'synced', clientUpdatedAt: 3010, updatedAt: 3012 }), syncedAt: 3012 })
assert.equal(syncCalls.length, 2)
assert.equal(syncCalls[1].currentTaskIndex, 1)
let failedSync
cloud.saveProductV0DraftToCloud = (requested, callbacks) => { failedSync = callbacks }
const failedDraft = runtime.answerItem(store.getSession(), 'RR01', runtime.resolveFormat(runtime.getEntry('RR01').item.response).options[1].code, 3020)
failedDraft.status = 'pending_cloud'
store.saveSession(failedDraft)
page._cloudSyncing = false
page.syncPending()
failedSync.fail({ errMsg: 'request:fail network error' })
assert.equal(page.data.syncState, 'CLOUD_FAILED')
assert.match(page.data.syncStatusLabel, /已保存在本机/)
cloud.isCloudReady = originalCloudReady
cloud.saveProductV0DraftToCloud = originalSaveDraft

console.log('assessment-v3-product-v0 page helpers OK: separate first task, chapter state, and compound items')
