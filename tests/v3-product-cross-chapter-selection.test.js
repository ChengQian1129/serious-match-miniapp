const assert = require('node:assert/strict')
const { listFixtures } = require('../shared/assessment-v3-product/fixtures')
const { selectSummaryPatterns } = require('../shared/assessment-v3-product/report-renderer')

listFixtures().forEach(fixture => {
  const selected = selectSummaryPatterns(fixture)
  assert.ok(selected.length <= 3)
  assert.equal(new Set(selected.map(item => item.id)).size, selected.length)
  selected.forEach(item => {
    assert.ok(item.headline)
    assert.ok(item.summary)
    assert.equal(item.id.includes('dimension'), false)
  })
})

const specific = selectSummaryPatterns({ summaryPatternIds: ['READINESS_CAPACITY_GAP', 'PRESSURE_CAPACITY_GAP'] })
assert.deepEqual(specific.map(item => item.id), ['PRESSURE_CAPACITY_GAP'])

console.log('V3 cross-chapter selection OK: bounded, unique, narrative-backed summaries')
