const assert = require('node:assert/strict')
const { getFixture } = require('../shared/assessment-v3-product/fixtures')
const { createDerivedV3Profile, clone } = require('../shared/assessment-v3-product/contract')
const { evaluatePattern } = require('../shared/assessment-v3-product/pattern-eligibility')

function withChanges(changes) {
  const profile = clone(getFixture('ready_self'))
  Object.entries(changes.dimensionResults || {}).forEach(([dimensionId, values]) => {
    Object.assign(profile.dimensionResults[dimensionId], values)
  })
  Object.assign(profile.patternContext, changes.patternContext || {})
  return createDerivedV3Profile(profile)
}

function eligible(patternId, changes) {
  return evaluatePattern(withChanges(changes), patternId).eligible
}

assert.equal(eligible('HIGH_ACTIVATION_LOW_SIGNAL', {
  dimensionResults: {
    uncertainty_activation: { state: 'HIGH' },
    support_signaling: { state: 'LOW' }
  }
}), true)
assert.equal(eligible('HIGH_ACTIVATION_LOW_SIGNAL', {
  dimensionResults: {
    uncertainty_activation: { state: 'MID' },
    support_signaling: { state: 'LOW' }
  }
}), false)
assert.equal(eligible('HIGH_ACTIVATION_LOW_SIGNAL', {
  dimensionResults: {
    uncertainty_activation: { state: 'HIGH' },
    support_signaling: { state: 'HIGH' }
  }
}), false)

assert.equal(eligible('HIGH_ACTIVATION_REASSURANCE', {
  dimensionResults: {
    uncertainty_activation: { state: 'HIGH' },
    support_need: { state: 'CLARITY_REASSURANCE' }
  }
}), true)
assert.equal(eligible('HIGH_ACTIVATION_REASSURANCE', {
  dimensionResults: {
    uncertainty_activation: { state: 'HIGH' },
    support_need: { state: 'LISTEN_VALIDATE' }
  }
}), false)

assert.equal(eligible('INTIMACY_HIGH_SPACE_HIGH', {
  dimensionResults: {
    intimacy_dependence_comfort: { state: 'HIGH' },
    personal_space_need: { state: 'HIGH' }
  }
}), true)
assert.equal(eligible('INTIMACY_HIGH_SPACE_HIGH', {
  dimensionResults: {
    intimacy_dependence_comfort: { state: 'MID' },
    personal_space_need: { state: 'HIGH' }
  }
}), false)

assert.equal(eligible('CONFLICT_HIGH_REPAIR_HIGH', {
  dimensionResults: {
    conflict_activation: { state: 'HIGH' },
    repair_reengagement: { state: 'HIGH' }
  }
}), true)
assert.equal(eligible('CONFLICT_HIGH_REPAIR_HIGH', {
  dimensionResults: {
    conflict_activation: { state: 'MID' },
    repair_reengagement: { state: 'HIGH' }
  }
}), false)

assert.equal(eligible('SPACE_PACING_SHARED', {
  dimensionResults: { personal_space_need: { state: 'HIGH' }, conflict_pacing_need: { state: 'LONGER_PAUSE' } }
}), true)
assert.equal(eligible('SPACE_PACING_SHARED', {
  dimensionResults: { personal_space_need: { state: 'HIGH' }, conflict_pacing_need: { state: 'FLEXIBLE' } }
}), true)
assert.equal(eligible('SPACE_PACING_SHARED', {
  dimensionResults: { personal_space_need: { state: 'HIGH' }, conflict_pacing_need: { state: 'SHORT_PAUSE' } }
}), false)

const missing = clone(getFixture('ready_self'))
delete missing.patternContext.majorConstraintConflict
const missingResult = evaluatePattern(missing, 'AUTONOMOUS_READINESS_CONSTRAINT')
assert.equal(missingResult.eligible, false)
assert.equal(missingResult.reason, 'INSUFFICIENT_PATTERN_INPUT')

console.log('V3 pattern eligibility OK: ordinal, categorical, context, and insufficient-input triggers')
