const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const storage = new Map()

global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  navigateBack() {},
  reLaunch() {},
  navigateTo() {}
}
const definitions = []
global.Page = definition => definitions.push(definition)

const researchPage = require('../pages/v3-p0-research/index.js')
const codingPage = require('../pages/v3-p0-coding/index.js')
const engine = require('../shared/assessment-v3-p0/runtime-engine')
const store = require('../utils/assessment-v3-p0/session-store')
assert.equal(definitions.length, 2)

const session = store.emptySession({
  waveId: 'wave1',
  participantStudyId: 'P0-004',
  relationshipContext: {
    relationshipHistoryCategory: 'HYPOTHETICAL',
    currentDatingStatus: 'NOT_DATING',
    responseContextForRelationshipItems: 'HYPOTHETICAL'
  }
})
const publicTask = engine.getPublicTask('UA-S01')
const taskView = researchPage.buildTaskView(publicTask, session)
assert.equal(taskView.isCompound, true)
assert.equal(taskView.items.length, 3)
assert.equal(Object.prototype.hasOwnProperty.call(taskView, 'participantStudyId'), false)
assert.equal(Object.prototype.hasOwnProperty.call(taskView, 'constructId'), false)
assert.equal(Object.prototype.hasOwnProperty.call(taskView, 'probeFocus'), false)
assert.equal(taskView.items[0].response.options.length > 0, true)

const itemList = codingPage.buildItemList(session)
assert.equal(itemList.some(item => item.itemId === 'UA-S01.a'), true)
assert.equal(typeof itemList.find(item => item.itemId === 'UA-S01.a').fieldCode, 'string')
assert.equal(itemList.find(item => item.itemId === 'UA-S01.a').probeFocus.length > 0, true)

const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'))
assert.equal(app.pages.includes('pages/v3-p0-research/index'), true)
assert.equal(app.pages.includes('pages/v3-p0-coding/index'), true)
const features = require('../utils/features').FEATURES
assert.equal(features.v3P0Research, false)

console.log('V3 P0 page boundary and internal routing checks OK')
