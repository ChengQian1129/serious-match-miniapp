const assert = require('node:assert/strict')
const engine = require('../shared/assessment-v3-p0/runtime-engine')

const assignments = engine.WAVE_IDS.map(waveId => engine.buildWaveAssignment(waveId))
assert.deepEqual(assignments.map(item => item.waveId), ['wave1', 'wave2', 'wave3'])
assert.deepEqual(assignments.map(item => item.taskCount), [20, 24, 34])
assert.equal(new Set(assignments.flatMap(item => item.taskIds)).size, 78)

assignments.forEach(assignment => {
  assert.deepEqual(assignment.taskIds, engine.BUNDLE.taskIdsByWave[assignment.waveId])
  assignment.taskIds.forEach(taskId => assert.equal(engine.itemParentForWave(assignment.waveId, taskId), taskId))
})

assert.equal(engine.itemParentForWave('wave1', 'IDC03'), null)
assert.equal(engine.itemParentForWave('wave2', 'RR01'), null)
assert.equal(engine.itemParentForWave('wave3', 'UA-S01.a'), null)
assert.throws(() => engine.buildWaveAssignment('P1'), /UNKNOWN_WAVE/)

const publicTask = engine.getPublicTask('UA-S01')
assert.equal(publicTask.isCompound, true)
assert.equal(publicTask.children.length, 3)
assert.equal(Object.prototype.hasOwnProperty.call(publicTask, 'constructId'), false)
assert.equal(Object.prototype.hasOwnProperty.call(publicTask, 'probeFocus'), false)
assert.equal(Object.prototype.hasOwnProperty.call(publicTask, 'responseContext'), false)
assert.equal(Object.prototype.hasOwnProperty.call(publicTask, 'scoringStatus'), false)

console.log('V3 P0 wave routing and participant boundary OK')
