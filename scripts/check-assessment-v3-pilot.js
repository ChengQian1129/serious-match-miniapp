const assert = require('node:assert/strict')
const fs = require('node:fs')
const engine = require('../shared/assessment-v3-pilot/runtime-engine')
const { validateSources, renderBundle, renderManifest, BUNDLE_PATH, MANIFEST_PATH } = require('./sync-assessment-v3-pilot')

const artifacts = validateSources()
assert.equal(fs.readFileSync(BUNDLE_PATH, 'utf8'), renderBundle(artifacts.bundle), 'generated runtime bundle is stale; run npm run sync:assessment-v3-pilot')
assert.equal(fs.readFileSync(MANIFEST_PATH, 'utf8'), renderManifest(artifacts.manifest), 'generated V3 manifest is stale; run npm run sync:assessment-v3-pilot')

const bundle = engine.BUNDLE
assert.equal(bundle.instrument.scoring, 'NONE_IN_RUNTIME')
assert.equal(bundle.commonSpine.length, 57)
assert.equal(new Set(bundle.commonSpine).size, bundle.commonSpine.length)
assert.equal(Object.keys(bundle.tasks).length, 411)
assert.equal(bundle.reportCore.parentTaskCount, 266)

Object.entries(bundle.forms).forEach(([formKey, form]) => {
  const seen = new Set()
  Object.entries(form.pools).forEach(([poolId, definition]) => {
    assert.ok(definition.sample <= definition.pool.length, `${formKey}/${poolId} sample overflow`)
    definition.pool.forEach(taskId => {
      assert.ok(bundle.tasks[taskId], `${formKey}/${poolId}: unknown task ${taskId}`)
      assert.ok(!bundle.commonSpine.includes(taskId), `${formKey}/${poolId}: common overlap ${taskId}`)
      assert.ok(!seen.has(taskId), `${formKey}: duplicated across pools ${taskId}`)
      seen.add(taskId)
    })
  })
})

for (let i = 0; i < 3000; i += 1) {
  const assignment = engine.buildAssignment(`audit-${i}`)
  assert.equal(new Set(assignment.assignedParentTaskIds).size, assignment.assignedParentTaskIds.length)
}

console.log('assessment-v3-pilot source/generated/runtime checks OK')
