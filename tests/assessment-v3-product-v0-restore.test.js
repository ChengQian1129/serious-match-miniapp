const assert = require('node:assert/strict')
const { resolveProductRestoreDecision } = require('../utils/assessment-v3-product-v0/restore')

function session(updatedAt, status = 'synced') {
  return { assessmentType: 'v3-product-v0', answerEvents: [{ itemId: 'RR01' }], updatedAt, status }
}

assert.equal(resolveProductRestoreDecision({ answerEvents: [] }, null), 'new')
assert.equal(resolveProductRestoreDecision(session(10, 'pending_cloud'), null), 'local')
assert.equal(resolveProductRestoreDecision({ answerEvents: [] }, session(20)), 'cloud')
assert.equal(resolveProductRestoreDecision(session(10), session(20)), 'cloud')
assert.equal(resolveProductRestoreDecision(session(20, 'pending_cloud'), session(10)), 'local-sync')
assert.equal(resolveProductRestoreDecision(session(10, 'pending_cloud'), session(20)), 'conflict')
assert.equal(resolveProductRestoreDecision(null, null), 'new')

console.log('Product v0 restore matrix OK: new, local, cloud, newer cloud, local sync, conflict, and empty restore')
