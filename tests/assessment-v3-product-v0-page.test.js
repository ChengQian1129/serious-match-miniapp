const assert = require('node:assert/strict')
let definition
global.Page = value => { definition = value }
const page = require('../pages/questionnaire-v3/index')
const store = require('../utils/assessment-v3-product-v0/session-store')
const runtime = require('../shared/assessment-v3-product-v0/runtime-engine')

const session = store.emptySession(123)
const state = page.pageState(session)
assert.equal(state.taskId, 'RR01')
assert.equal(state.chapter, 'C1')
assert.equal(state.chapterNumber, 1)
assert.ok(state.items.length)
assert.equal(state.canContinue, false)
const task = runtime.getTask('SN-S01')
assert.equal(page.buildItems(task, session).length, 2)
assert.equal(page.chapterIndex('C6'), 5)

console.log('assessment-v3-product-v0 page helpers OK: separate first task, chapter state, and compound items')
