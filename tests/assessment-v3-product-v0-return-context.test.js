const assert = require('node:assert/strict')
const {
  normalizeReturnContext,
  encodeReturnContext,
  decodeReturnContext,
  resolveReturnContext,
  contextUrl,
  questionnaireEditUrl,
  parentResultUrl
} = require('../utils/assessment-v3-product-v0/return-context')

const context = normalizeReturnContext({
  source: 'evidence',
  targetId: 'relationship_readiness',
  scrollAnchor: 'RR01',
  reportVersion: 3
})
assert.deepEqual(decodeReturnContext(encodeReturnContext(context)), context)
assert.match(questionnaireEditUrl('RR01', context), /mode=edit/)
assert.match(questionnaireEditUrl('RR01', context), /returnContext=/)
assert.match(contextUrl(context), /v3-result-evidence/)
assert.match(contextUrl(context), /dimension=relationship_readiness/)
assert.equal(parentResultUrl({ source: 'partial-result' }, true), '/pages/v3-result/index?mode=product-v0&scope=partial')
assert.deepEqual(resolveReturnContext({ returnTo: encodeURIComponent('/pages/v3-result/index?mode=product-v0&scope=partial') }), {
  source: 'partial-result', targetId: '', scrollAnchor: '', reportVersion: 0
})
assert.equal(normalizeReturnContext({ source: 'evidence', targetId: 'bad/id' }).targetId, '')

console.log('Product v0 return context OK: structured result, evidence, review, and legacy URL recovery')
