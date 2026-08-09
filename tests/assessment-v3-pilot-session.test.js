const assert = require('node:assert/strict')
const storage = new Map()

global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const store = require('../utils/assessment-v3-pilot/session-store')
const engine = require('../shared/assessment-v3-pilot/runtime-engine')

function fresh(startedAt = 1700000000000) {
  const session = store.emptySession(startedAt)
  store.saveSession(session)
  return session
}

let session = fresh()
const original = JSON.parse(JSON.stringify(session.assignment))

session = store.getSession()
assert.equal(session.assignment.assignedParentTaskIds.length >= 80, true)

// Answer parenthood desire/intention and verify branch assignment updates deterministically.
store.answerItem('L5-CH01', '5')
store.answerItem('L5-CH02', '5')
session = store.getSession()
assert.ok(session.assignment.earlyBranchIds.includes('PARENTHOOD_TIMING'))
assert.ok(session.assignment.earlyBranchIds.includes('PARENTHOOD_OPEN_OR_WANTS'))
assert.ok(session.assignment.assignedParentTaskIds.includes('L5-CH03'))
assert.ok(session.assignment.assignedParentTaskIds.includes('L3-PO01'))

// Form selection and sampled form tasks remain unchanged when early branches are rebuilt.
assert.equal(session.assignment.formKey, original.formKey)
assert.deepEqual(session.assignment.formTaskIds, original.formTaskIds)

// Immutable event chain.
store.answerItem('L5-CH01', '4')
session = store.getSession()
const events = session.answerEvents.filter(x => x.itemId === 'L5-CH01')
assert.equal(events.length, 2)
assert.equal(events[1].supersedesEventId, events[0].eventId)

// Resume uses same assignment.
const snap = JSON.parse(JSON.stringify(session.assignment))
const resumed = store.getSession()
assert.deepEqual(resumed.assignment, snap)

// Compound tasks complete when every child is answered or explicitly missing.
session = fresh(1700000000100)
const compoundIndex = session.assignment.assignedParentTaskIds.indexOf('SN-S01')
assert.ok(compoundIndex >= 0)
store.setParentIndex(compoundIndex)
store.answerItem('SN-S01.a', ['1'])
store.markMissing('SN-S01.b', 'NOT_APPLICABLE')
assert.equal(store.getProgress().completedParents, 1)
assert.doesNotThrow(() => store.goNext())

// Missingness is not a numerical answer, but it advances progress and can complete a task.
session = fresh(1700000000200)
store.markMissing('FACT01', 'USER_SKIPPED')
assert.equal(store.getProgress().completedParents, 1)
store.answerItem('FACT01', 1988)
assert.equal(Object.prototype.hasOwnProperty.call(store.getSession().missingness, 'FACT01'), false)

// A response outside the assignment cannot be written, and multi-select limits are enforced.
session = fresh(1700000000300)
const assigned = new Set(session.assignment.assignedParentTaskIds)
const unassigned = Object.keys(engine.BUNDLE.tasks).find(id => !assigned.has(id))
assert.ok(unassigned)
assert.throws(() => store.answerItem(unassigned, '1'), /不在当前 Pilot 分配/)
store.setParentIndex(session.assignment.assignedParentTaskIds.indexOf('SN-S01'))
assert.throws(() => store.answerItem('SN-S01.a', ['1', '2', '3']), /MAX_SELECTIONS_2/)

// Changing an early branch keeps the current task identity rather than a stale numeric index.
session = fresh(1700000000400)
store.setParentIndex(session.assignment.assignedParentTaskIds.indexOf('L5-CH01'))
store.answerItem('L5-CH01', '5')
assert.equal(store.currentParentTaskId(), 'L5-CH01')
store.setParentIndex(session.assignment.assignedParentTaskIds.indexOf('L5-CH02'))
store.answerItem('L5-CH02', '5')
assert.equal(store.currentParentTaskId(), 'L5-CH02')
store.answerItem('L5-CH02', '1')
assert.equal(store.currentParentTaskId(), 'L5-CH02')
assert.ok(store.getSession().taskEvents.some(event => event.eventType === 'BRANCH_ENTER'))
assert.ok(store.getSession().taskEvents.some(event => event.eventType === 'BRANCH_EXIT'))

// Answer records retain item/form/context metadata and a response-time measurement.
session = fresh(1700000000500)
store.appendTaskEvent('TASK_SHOWN', { parentTaskId: 'FACT01', itemIds: ['FACT01'] })
store.answerItem('FACT01', 1988)
const answerEvent = store.getSession().answerEvents.find(event => event.itemId === 'FACT01')
assert.equal(answerEvent.parentTaskId, 'FACT01')
assert.equal(answerEvent.itemVersion, engine.BUNDLE.instrument.version)
assert.equal(answerEvent.researchForm, store.getSession().assignment.formKey)
assert.equal(typeof answerEvent.responseTimeMs, 'number')

// Every assigned item can be explicitly skipped, producing the no-scoring completion state.
session = fresh(1700000000600)
session.assignment.assignedParentTaskIds.forEach(parentId => {
  engine.expectedItemIdsForParent(parentId).forEach(itemId => {
    if (!Object.prototype.hasOwnProperty.call(store.getSession().answers, itemId)) store.markMissing(itemId, 'USER_SKIPPED')
  })
})
const completed = store.completeAssessment()
assert.equal(completed.status, 'completed_no_scoring')
assert.equal(completed.completedAt > 0, true)
assert.equal(completed.taskEvents.at(-1).eventType, 'COMPLETE')

console.log('assessment-v3-pilot session smoke OK')
