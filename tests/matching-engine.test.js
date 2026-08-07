const assert = require('node:assert/strict')
const { buildCandidateComparison } = require('../cloudfunctions/datingProfile/matching-engine')

function profile(gender, targetGender, birthDate, ageMin, ageMax) {
  return { status: 'active', matching: { matchingPoolConsentAt: 1 }, basic: { gender, targetGender, targetGenderPriority: 'must', birthDate }, relationship: { targetAgeMin: ageMin, targetAgeMax: ageMax, agePriority: 'must', goal: 'marriage', settlementPlan: 'stay_dalian', childPlan: 'want', childPlanPriority: 'important', availability: 'single_ready', maritalHistory: 'never_married', childrenStatus: 'none', distanceAcceptance: 'dalian_only', distancePriority: 'important', smokingStatus: 'never', smokingAcceptance: 'never', smokingPriority: 'must' } }
}
function evaluation(options = {}) {
  const dimensions = {}
  ;['response_predictability', 'emotional_support', 'autonomy_space', 'conflict_pause', 'repair_reengagement'].forEach(id => { dimensions[id] = { needState: 'need_flexible', provideState: 'provide_variable' } })
  dimensions.response_predictability = { needState: options.need || 'need_flexible', provideState: options.provide || 'provide_variable' }
  dimensions.uncertainty_sensitivity = { state: options.uncertainty || 'lean_less' }
  return { evaluation: { dimensions, observations: options.observations || {} } }
}

const left = profile('male', 'female', '1993-01-01', 25, 38)
const right = profile('female', 'male', '1995-01-01', 25, 38)
const result = buildCandidateComparison(left, evaluation({ need: 'need_clear', provide: 'provide_constrained', uncertainty: 'lean_present', observations: { REG01: 'active' } }), right, evaluation({ provide: 'provide_constrained', observations: { REG02: 'active' } }))
assert.equal(result.hardConditions.some(item => item.status === 'blocked'), false)
assert.equal(result.cautions.length, 1)
assert.equal(result.cautions[0].direction, 'A 的需要 ← B 的提供')
assert.equal(result.interaction.some(item => item.id === 'uncertainty_response_a'), true)
assert.equal(result.interaction.some(item => item.id === 'pursue_withdraw_ab'), true)
assert.equal('score' in result, false)

const blocked = buildCandidateComparison(left, evaluation(), profile('male', 'male', '1995-01-01', 25, 38), evaluation())
assert.equal(blocked.hardConditions.some(item => item.status === 'blocked'), true)
assert.equal(blocked.hardConditions.find(item => item.id === 'relationship_availability').status, 'pass')

const negotiableGender = profile('male', 'female', '1995-01-01', 25, 38)
negotiableGender.basic.targetGenderPriority = 'discuss'
const negotiable = buildCandidateComparison(left, evaluation(), negotiableGender, evaluation())
assert.equal(negotiable.hardConditions.find(item => item.id === 'right_gender_preference').status, 'review')

const unavailableProfile = profile('female', 'male', '1995-01-01', 25, 38)
unavailableProfile.relationship.availability = 'single_not_ready'
const unavailable = buildCandidateComparison(left, evaluation(), unavailableProfile, evaluation())
assert.equal(unavailable.hardConditions.find(item => item.id === 'relationship_availability').status, 'blocked')

const smokingProfile = profile('female', 'male', '1995-01-01', 25, 38)
smokingProfile.relationship.smokingStatus = 'regularly'
const smoking = buildCandidateComparison(left, evaluation(), smokingProfile, evaluation())
assert.equal(smoking.reality.find(item => item.id === 'smoking_boundary').status, 'confirm')

const incomplete = buildCandidateComparison({ status: 'active', matching: { matchingPoolConsentAt: 1 }, basic: { gender: 'male', targetGender: 'female' }, relationship: {} }, null, right, evaluation())
assert.equal(incomplete.hardConditions.find(item => item.id === 'right_age_preference').status, 'missing')
assert.ok(incomplete.unknowns.includes('A 的关系说明书'))
console.log('Matching engine OK: reciprocal filters, directional comparison, no total score')
