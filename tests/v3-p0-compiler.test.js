const assert = require('node:assert/strict')
const fs = require('node:fs')
const compiler = require('../scripts/sync-assessment-v3-p0')
const bundle = require('../shared/assessment-v3-p0/generated/runtime-bundle')
const manifest = require('../shared/assessment-v3-p0/generated/manifest.json')

const artifacts = compiler.validateSources()
assert.deepEqual(artifacts.manifest, manifest)
assert.deepEqual(artifacts.bundle.waveIds, ['wave1', 'wave2', 'wave3'])
assert.equal(artifacts.bundle.instrument.id, 'relationship_manual_v3_p0')
assert.equal(artifacts.bundle.instrument.version, '3.0.0-p0')
assert.equal(artifacts.bundle.instrument.scoring, 'NONE_IN_RUNTIME')
assert.equal(artifacts.bundle.scoring, 'NONE_IN_RUNTIME')
assert.equal(Object.keys(artifacts.bundle.tasks).length, 78)
assert.equal(artifacts.manifest.counts.childItems, 39)
assert.equal(Object.keys(artifacts.manifest.sourceHashes).length >= 7, true)
assert.equal(fs.existsSync(compiler.BUNDLE_PATH), true)
assert.equal(fs.existsSync(compiler.MANIFEST_PATH), true)

for (const waveId of artifacts.bundle.waveIds) {
  const taskIds = artifacts.bundle.taskIdsByWave[waveId]
  assert.equal(taskIds.length > 0, true)
  taskIds.forEach(taskId => assert.equal(artifacts.bundle.tasks[taskId].wave, waveId))
}

assert.equal(bundle.tasks['UA-S01'].children.length, 3)
assert.equal(bundle.tasks['UA-S01'].children[0].itemId, 'UA-S01.a')
assert.equal(bundle.tasks['RR01'].scoringStatus, 'PILOT_ONLY')
assert.equal(bundle.tasks['RR01'].prompt.length > 0, true)

console.log('V3 P0 compiler contract OK')
