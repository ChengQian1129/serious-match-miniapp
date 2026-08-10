const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const compiler = require('./sync-assessment-v3-p0')

const root = path.resolve(__dirname, '..')
const generatedManifestPath = path.join(root, 'shared/assessment-v3-p0/generated/manifest.json')
const generatedBundlePath = path.join(root, 'shared/assessment-v3-p0/generated/runtime-bundle.js')

const artifacts = compiler.validateSources()
assert.ok(fs.existsSync(generatedManifestPath), 'Missing generated P0 manifest')
assert.ok(fs.existsSync(generatedBundlePath), 'Missing generated P0 runtime bundle')
const manifest = JSON.parse(fs.readFileSync(generatedManifestPath, 'utf8'))
assert.deepEqual(manifest, artifacts.manifest, 'Generated P0 manifest is stale; run npm run sync:assessment-v3-p0')
delete require.cache[require.resolve('../shared/assessment-v3-p0/generated/runtime-bundle')]
const bundle = require('../shared/assessment-v3-p0/generated/runtime-bundle')

assert.equal(bundle.instrument.id, 'relationship_manual_v3_p0')
assert.equal(bundle.instrument.version, '3.0.0-p0')
assert.equal(bundle.instrument.scoring, 'NONE_IN_RUNTIME')
assert.deepEqual(bundle.waveIds, ['wave1', 'wave2', 'wave3'])
assert.equal(Object.keys(bundle.tasks).length, 78)
Object.values(bundle.tasks).forEach(task => {
  assert.equal(task.scoringStatus, 'PILOT_ONLY')
  assert.equal(Object.prototype.hasOwnProperty.call(task, 'score'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(task, 'reportContribution'), false)
})

console.log(`Assessment V3 P0 source/generated/runtime checks OK: ${Object.keys(bundle.tasks).length} parent tasks, ${manifest.counts.childItems} child items`)
