const assert = require('node:assert/strict')
const publicLanguage = require('../shared/content/public-language.generated')
const { PRODUCT_COPY } = require('../shared/assessment-v3-product/report-renderer')

assert.ok(PRODUCT_COPY.preview.title)
assert.ok(PRODUCT_COPY.preview.purpose)
assert.ok(PRODUCT_COPY.preview.value)
assert.ok(PRODUCT_COPY.preview.boundary)
assert.equal(PRODUCT_COPY.preview.notice.includes('真实回答'), true)
assert.ok(PRODUCT_COPY.decisions.l3.items.contact.body)
assert.ok(PRODUCT_COPY.decisions.l4.items.boundary.body)
assert.ok(PRODUCT_COPY.decisions.l5.items.feasibility.body)
assert.ok(PRODUCT_COPY.interview.items.supportPattern.body)
assert.equal(publicLanguage.v3.narratives.chapters.C2.HIGH_HIGH.summary, '')
assert.ok(publicLanguage.v3.narratives.chapterCompositions.C3.activation.HIGH.headline)
assert.ok(publicLanguage.v3.narratives.chapterCompositions.C3.strategy.CLARIFYING.headline)

function publicText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(publicText).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(publicText).join(' ')
  return ''
}

const text = publicText(PRODUCT_COPY)
;['Pilot', 'A/B/C', 'relationship_readiness', 'compatibility percentage', '关系画像', '人格类型'].forEach(forbidden => {
  assert.equal(text.includes(forbidden), false, `product copy leaked ${forbidden}`)
})

console.log('V3 product public copy OK: registry-backed and free of internal labels')
