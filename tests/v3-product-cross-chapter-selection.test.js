const assert = require('node:assert/strict')
const { listFixtures, getFixture } = require('../shared/assessment-v3-product/fixtures')
const { selectSummaryPatterns } = require('../shared/assessment-v3-product/report-renderer')
const { createDerivedV3Profile, clone } = require('../shared/assessment-v3-product/contract')
const { derivePatternEligibility, evaluatePattern } = require('../shared/assessment-v3-product/pattern-eligibility')

listFixtures().forEach(fixture => {
  const selected = selectSummaryPatterns(fixture)
  assert.ok(selected.length <= 3)
  assert.equal(new Set(selected.map(item => item.id)).size, selected.length)
  selected.forEach(item => {
    assert.ok(item.headline)
    assert.ok(item.summary)
    assert.equal(item.id.includes('dimension'), false)
  })
  const eligibility = new Map(derivePatternEligibility(fixture).map(item => [item.patternId, item]))
  selected.forEach(item => assert.equal(eligibility.get(item.id).eligible, true, `${item.id} must satisfy its normative trigger`))
  ;(fixture.expectedPatternIds || []).forEach(patternId => assert.equal(evaluatePattern(fixture, patternId).eligible, true, `${fixture.persona.id} expectation ${patternId} is not eligible`))
  assert.equal(Object.prototype.hasOwnProperty.call(fixture, 'summaryPatternIds'), false)
})

const specificBase = clone(getFixture('ready_self'))
specificBase.dimensionResults.available_capacity.state = 'LOW'
specificBase.patternContext.pressure = 'HIGH'
const specific = selectSummaryPatterns(createDerivedV3Profile(specificBase))
assert.equal(specific[0].id, 'PRESSURE_CAPACITY_GAP')
assert.equal(specific.some(item => item.id === 'READINESS_CAPACITY_GAP'), false)

const failedActivation = clone(getFixture('ready_self'))
failedActivation.dimensionResults.uncertainty_activation.state = 'MID'
failedActivation.dimensionResults.support_signaling.state = 'LOW'
assert.equal(evaluatePattern(createDerivedV3Profile(failedActivation), 'HIGH_ACTIVATION_LOW_SIGNAL').eligible, false)

const failedSignal = clone(getFixture('ready_self'))
failedSignal.dimensionResults.uncertainty_activation.state = 'HIGH'
failedSignal.dimensionResults.support_signaling.state = 'HIGH'
assert.equal(evaluatePattern(createDerivedV3Profile(failedSignal), 'HIGH_ACTIVATION_LOW_SIGNAL').eligible, false)

const missingContext = clone(getFixture('ready_self'))
delete missingContext.patternContext.pressure
const missingResult = evaluatePattern(createDerivedV3Profile(missingContext), 'PRESSURE_CAPACITY_GAP')
assert.equal(missingResult.eligible, false)
assert.equal(missingResult.reason, 'INSUFFICIENT_PATTERN_INPUT')

console.log('V3 cross-chapter selection OK: trigger-eligible, bounded, unique, narrative-backed summaries')
