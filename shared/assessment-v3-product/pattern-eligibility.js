const { crossChapterPatterns: CROSS_CHAPTER_PATTERNS } = require('./normative-generated')
const { FIVE_ZONE_STATES, THREE_ZONE_STATES } = require('./contract')

function dimensionState(profile, dimensionId) {
  return profile && profile.dimensionResults && profile.dimensionResults[dimensionId] && profile.dimensionResults[dimensionId].state
}

const FIELD_RESOLVERS = Object.freeze({
  'C1.readiness': { resolve: profile => dimensionState(profile, 'relationship_readiness'), order: FIVE_ZONE_STATES },
  'C1.pressure': { resolve: profile => profile.patternContext && profile.patternContext.pressure, order: THREE_ZONE_STATES },
  'C1.autonomous': { resolve: profile => profile.patternContext && profile.patternContext.autonomous, order: THREE_ZONE_STATES },
  'C2.capacity': { resolve: profile => dimensionState(profile, 'available_capacity'), order: THREE_ZONE_STATES },
  'C2.followThrough': { resolve: profile => dimensionState(profile, 'relational_follow_through'), order: FIVE_ZONE_STATES },
  'C3.activation': { resolve: profile => dimensionState(profile, 'uncertainty_activation'), order: FIVE_ZONE_STATES },
  'C4.intimacy': { resolve: profile => dimensionState(profile, 'intimacy_dependence_comfort'), order: FIVE_ZONE_STATES },
  'C4.space': { resolve: profile => dimensionState(profile, 'personal_space_need'), order: THREE_ZONE_STATES },
  'C5.supportNeed': { resolve: profile => dimensionState(profile, 'support_need') },
  'C5.supportNeedKnown': { resolve: profile => profile.patternContext && profile.patternContext.supportNeedKnown },
  'C5.signaling': { resolve: profile => dimensionState(profile, 'support_signaling'), order: THREE_ZONE_STATES },
  'C5.responsiveness': { resolve: profile => dimensionState(profile, 'responsiveness_capability'), order: THREE_ZONE_STATES },
  'C6.activation': { resolve: profile => dimensionState(profile, 'conflict_activation'), order: FIVE_ZONE_STATES },
  'C6.pacing': { resolve: profile => dimensionState(profile, 'conflict_pacing_need') },
  'C6.repair': { resolve: profile => dimensionState(profile, 'repair_reengagement'), order: THREE_ZONE_STATES },
  'L5.majorConstraintConflict': { resolve: profile => profile.patternContext && profile.patternContext.majorConstraintConflict }
})

const PRIORITY_ORDER = Object.freeze({ HIGH: 0, MEDIUM: 1, LOW: 2 })

function getPatternDefinition(patternId) {
  return CROSS_CHAPTER_PATTERNS.find(pattern => pattern.patternId === patternId) || null
}

function compareOrdinal(actual, operator, expected, order) {
  if (!order) return { matched: false, reason: 'NON_ORDINAL_COMPARISON' }
  const actualIndex = order.indexOf(actual)
  const expectedIndex = order.indexOf(expected)
  if (actualIndex < 0 || expectedIndex < 0) return { matched: false, reason: 'INSUFFICIENT_PATTERN_INPUT' }
  if (operator === '>=') {
    const matched = actualIndex >= expectedIndex
    return { matched, reason: matched ? null : 'TRIGGER_NOT_SATISFIED' }
  }
  if (operator === '<=') {
    const matched = actualIndex <= expectedIndex
    return { matched, reason: matched ? null : 'TRIGGER_NOT_SATISFIED' }
  }
  return { matched: false, reason: 'UNSUPPORTED_TRIGGER_OPERATOR' }
}

function evaluateTrigger(profile, trigger) {
  const field = FIELD_RESOLVERS[trigger.field]
  if (!field) return { matched: false, reason: 'INSUFFICIENT_PATTERN_INPUT', trigger }
  const actual = field.resolve(profile)
  if (actual === undefined || actual === null || actual === '') return { matched: false, reason: 'INSUFFICIENT_PATTERN_INPUT', trigger }
  if (trigger.operator === '=') return { matched: actual === trigger.value, reason: actual === trigger.value ? null : 'TRIGGER_NOT_SATISFIED', trigger, actual }
  if (trigger.operator === 'in') return { matched: trigger.value.includes(actual), reason: trigger.value.includes(actual) ? null : 'TRIGGER_NOT_SATISFIED', trigger, actual }
  const result = compareOrdinal(actual, trigger.operator, trigger.value, field.order)
  return Object.assign({}, result, { trigger, actual })
}

function evaluatePattern(profile, patternId) {
  const pattern = getPatternDefinition(patternId)
  if (!pattern) return { patternId, eligible: false, reason: 'UNKNOWN_PATTERN' }
  let insufficientInput = false
  let failedTrigger = null
  for (const trigger of pattern.triggers) {
    const result = evaluateTrigger(profile, trigger)
    if (result.reason === 'INSUFFICIENT_PATTERN_INPUT' || result.reason === 'NON_ORDINAL_COMPARISON') insufficientInput = true
    if (!result.matched && result.reason !== 'INSUFFICIENT_PATTERN_INPUT' && !failedTrigger) failedTrigger = trigger
  }
  if (insufficientInput) return { patternId, eligible: false, reason: 'INSUFFICIENT_PATTERN_INPUT' }
  if (failedTrigger) return { patternId, eligible: false, reason: 'TRIGGER_NOT_SATISFIED', failedTrigger }
  return { patternId, eligible: true, reason: null }
}

function derivePatternEligibility(profile) {
  return CROSS_CHAPTER_PATTERNS.map(pattern => Object.assign({
    priorityRank: PRIORITY_ORDER[pattern.priority] === undefined ? PRIORITY_ORDER.LOW : PRIORITY_ORDER[pattern.priority]
  }, evaluatePattern(profile, pattern.patternId), { definition: pattern }))
}

function deriveEligiblePatternIds(profile) {
  return derivePatternEligibility(profile)
    .filter(item => item.eligible)
    .sort((left, right) => left.priorityRank - right.priorityRank || left.definition.order - right.definition.order)
    .map(item => item.patternId)
}

module.exports = {
  CROSS_CHAPTER_PATTERNS,
  FIELD_RESOLVERS,
  getPatternDefinition,
  evaluateTrigger,
  evaluatePattern,
  derivePatternEligibility,
  deriveEligiblePatternIds
}
