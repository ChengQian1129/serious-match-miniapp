const assert = require('node:assert/strict')
const fs = require('node:fs')

const runtimeSource = fs.readFileSync(require.resolve('../shared/assessment-v3-pilot/runtime-engine'), 'utf8')
const engine = require('../shared/assessment-v3-pilot/runtime-engine')

assert.equal(runtimeSource.includes("require('node:crypto')"), false)
assert.equal(engine.hashToUInt('same-seed'), engine.hashToUInt('same-seed'))
assert.notEqual(engine.hashToUInt('same-seed'), engine.hashToUInt('different-seed'))

const seenAssignments = new Map()
for (let index = 0; index < 1000; index += 1) {
  const seed = `assignment-${index}`
  const first = engine.buildAssignment(seed)
  const second = engine.buildAssignment(seed)
  assert.deepEqual(first, second)
  assert.equal(new Set(first.assignedParentTaskIds).size, first.assignedParentTaskIds.length)
  seenAssignments.set(seed, first.formKey)
}
assert.equal(seenAssignments.size, 1000)

console.log('V3 WeChat-safe deterministic assignment OK: no Node crypto, stable seeds, no duplicate tasks')
