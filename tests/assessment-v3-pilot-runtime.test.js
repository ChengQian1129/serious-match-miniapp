const assert = require('node:assert/strict')

const engine = require('../shared/assessment-v3-pilot/runtime-engine')

function noDuplicates(xs) { return new Set(xs).size === xs.length }

assert.equal(engine.hashToUInt('fixture-baseline'), 6925616)
assert.equal(engine.formKeyFromSeed('fixture-baseline'), 'B')

const formCounts = { A: 0, B: 0, C: 0 }
for (let index = 0; index < 10000; index += 1) {
  const form = engine.formKeyFromSeed(`balance-${index}`)
  formCounts[form] += 1
  assert.ok(['A', 'B', 'C'].includes(form))
}
assert.ok(Math.max(...Object.values(formCounts)) - Math.min(...Object.values(formCounts)) < 250, `assignment imbalance: ${JSON.stringify(formCounts)}`)

// Deterministic form/assignment.
const a1 = engine.buildAssignment('fixture-baseline')
const a2 = engine.buildAssignment('fixture-baseline')
assert.deepEqual(a1, a2)
assert.ok(noDuplicates(a1.assignedParentTaskIds))
assert.equal(a1.commonTaskIds.length, 57)

// Parenthood branches are response-driven.
const pYes = engine.buildAssignment('fixture-parent', { 'L5-CH01': '5', 'L5-CH02': '5' })
assert.ok(pYes.earlyBranchIds.includes('PARENTHOOD_TIMING'))
assert.ok(pYes.earlyBranchIds.includes('PARENTHOOD_OPEN_OR_WANTS'))
assert.ok(pYes.assignedParentTaskIds.includes('L5-CH03'))
assert.ok(pYes.assignedParentTaskIds.includes('L3-PO01'))
assert.ok(noDuplicates(pYes.assignedParentTaskIds))

const pNo = engine.buildAssignment('fixture-parent-no', { 'L5-CH01': '1', 'L5-CH02': '1' })
assert.ok(!pNo.assignedParentTaskIds.includes('L5-CH03'))
assert.ok(!pNo.assignedParentTaskIds.includes('L3-PO01'))

const pUnsure = engine.buildAssignment('fixture-parent-unsure', { 'L5-CH01': '3', 'L5-CH02': '3' })
assert.ok(pUnsure.assignedParentTaskIds.includes('L5-CH06'))
assert.ok(pUnsure.assignedParentTaskIds.includes('L3-PO01'))
assert.ok(!pUnsure.assignedParentTaskIds.includes('L5-CH03'))

// Response validation.
assert.equal(engine.validateItemResponse('RR01', '7').ok, true)
assert.equal(engine.validateItemResponse('RR01', '99').ok, false)
assert.equal(engine.validateItemResponse('UA-S01.a', '3').ok, true)
assert.equal(engine.validateItemResponse('UA-S01.a', '99').ok, false)

const sn = engine.getTask('SN-S01')
assert.ok(sn.children && sn.children.length >= 2)
assert.deepEqual(engine.expectedItemIdsForParent('SN-S01'), sn.children.map(x => x.itemId))

// Explicitly deferred branches are visible rather than silently active.
const deferred = engine.getDeferredBranches()
assert.ok(deferred.some(x => x.id === 'HARD_CONSTRAINT_CONFIRMATION'))
assert.ok(deferred.some(x => x.id === 'WORLDVIEW_DEEP'))

console.log('assessment-v3-pilot runtime OK')
