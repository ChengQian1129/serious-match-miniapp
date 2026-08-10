const { c3ChapterRule } = require('./normative-generated')

const DIMENSION_IDS = Object.freeze([
  'relationship_readiness',
  'initiation_motivation',
  'available_capacity',
  'relational_follow_through',
  'uncertainty_activation',
  'uncertainty_regulation',
  'intimacy_dependence_comfort',
  'personal_space_need',
  'support_need',
  'support_signaling',
  'responsiveness_capability',
  'conflict_activation',
  'conflict_pacing_need',
  'repair_reengagement'
])

const CHAPTERS = Object.freeze([
  { id: 'C1', dimensionIds: ['relationship_readiness', 'initiation_motivation'] },
  { id: 'C2', dimensionIds: ['available_capacity', 'relational_follow_through'] },
  { id: 'C3', dimensionIds: ['uncertainty_activation', 'uncertainty_regulation'] },
  { id: 'C4', dimensionIds: ['intimacy_dependence_comfort', 'personal_space_need'] },
  { id: 'C5', dimensionIds: ['support_need', 'support_signaling', 'responsiveness_capability'] },
  { id: 'C6', dimensionIds: ['conflict_activation', 'conflict_pacing_need', 'repair_reengagement'] }
])

const CONFIDENCE_LEVELS = Object.freeze(['LOW', 'MEDIUM', 'HIGH'])
const EVIDENCE_STATUSES = Object.freeze(['PROVISIONAL', 'MEASURED'])
const EVIDENCE_ROLES = Object.freeze(['supporting', 'qualifying', 'contradicting'])
const FIVE_ZONE_STATES = Object.freeze(['VERY_LOW', 'LOW', 'MID', 'HIGH', 'VERY_HIGH'])
const THREE_ZONE_STATES = Object.freeze(['LOW', 'MID', 'HIGH'])
const UNCERTAINTY_REGULATION_STATES = Object.freeze([
  'CLARIFYING',
  'OBSERVING',
  'REASSURANCE_ORIENTED',
  'MONITORING_ORIENTED',
  'RUMINATIVE',
  'TESTING_PROTEST',
  'TOLERANT_WAITING',
  'WITHDRAWING',
  'MIXED'
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function fail(message) {
  throw new Error(`Invalid DerivedV3Profile: ${message}`)
}

function deriveC3ChapterState(dimensionResults) {
  const activation = dimensionResults && dimensionResults.uncertainty_activation
  const regulation = dimensionResults && dimensionResults.uncertainty_regulation
  if (!activation || !regulation) return null
  return {
    activation: activation.resultStatus === 'INSUFFICIENT' ? null : activation.state,
    primaryStrategy: regulation.resultStatus === 'INSUFFICIENT' ? null : regulation.state,
    secondaryStrategy: regulation.resultStatus === 'INSUFFICIENT' ? null : (regulation.secondaryState || null)
  }
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object`)
}

function assertDerivedV3Profile(profile) {
  assertObject(profile, 'profile')
  if (profile.contractVersion !== 'v3.derived-profile.v1.0') fail('contractVersion is unsupported')
  if (!['synthetic_fixture', 'calibrated_production', 'THEORY_DRIVEN_PRODUCT_V0'].includes(profile.source)) fail('source is unsupported')
  if (profile.source === 'synthetic_fixture' && profile.isSynthetic !== true) fail('synthetic_fixture must be marked synthetic')
  if (profile.source !== 'synthetic_fixture' && profile.isSynthetic === true) fail(`${profile.source} cannot be marked synthetic`)
  assertObject(profile.assessmentMeta, 'assessmentMeta')
  if (!profile.assessmentMeta.assessmentId) fail('assessmentMeta.assessmentId is required')
  if (profile.source === 'THEORY_DRIVEN_PRODUCT_V0') {
    const requiredMeta = ['assessedAt', 'instrumentVersion', 'productQuestionnaireVersion', 'scoringModelVersion', 'constructRegistryVersion', 'itemFreezeVersion', 'authoringLibraryVersion', 'reportVersion']
    requiredMeta.forEach(key => { if (!profile.assessmentMeta[key]) fail(`assessmentMeta.${key} is required for Product v0`) })
    if (profile.assessmentMeta.researchStatus !== 'THEORY_DRIVEN_PROVISIONAL') fail('Product v0 researchStatus must be THEORY_DRIVEN_PROVISIONAL')
  }
  assertObject(profile.dimensionResults, 'dimensionResults')
  const dimensionKeys = Object.keys(profile.dimensionResults)
  if (dimensionKeys.length !== DIMENSION_IDS.length) fail(`expected ${DIMENSION_IDS.length} dimension results`)
  DIMENSION_IDS.forEach(dimensionId => {
    const result = profile.dimensionResults[dimensionId]
    assertObject(result, `dimensionResults.${dimensionId}`)
    const resultStatus = result.resultStatus || 'ESTIMATED'
    if (!['ESTIMATED', 'INSUFFICIENT'].includes(resultStatus)) fail(`dimensionResults.${dimensionId}.resultStatus is invalid`)
    if (resultStatus === 'ESTIMATED' && !result.state) fail(`dimensionResults.${dimensionId}.state is required`)
    if (!CONFIDENCE_LEVELS.includes(result.confidence)) fail(`dimensionResults.${dimensionId}.confidence is invalid`)
    if (profile.source === 'THEORY_DRIVEN_PRODUCT_V0' && result.confidence === 'HIGH') fail(`dimensionResults.${dimensionId}.confidence cannot be HIGH in Product v0`)
    if (result.evidenceStatus && !EVIDENCE_STATUSES.includes(result.evidenceStatus)) fail(`dimensionResults.${dimensionId}.evidenceStatus is invalid`)
    if (result.evidence && !Array.isArray(result.evidence)) fail(`dimensionResults.${dimensionId}.evidence must be an array`)
    ;(result.evidence || []).forEach((entry, index) => {
      assertObject(entry, `dimensionResults.${dimensionId}.evidence[${index}]`)
      if (!entry.taskId) fail(`dimensionResults.${dimensionId}.evidence[${index}].taskId is required`)
      if (entry.role && !EVIDENCE_ROLES.includes(entry.role)) fail(`dimensionResults.${dimensionId}.evidence[${index}].role is invalid`)
    })
  })
  const activationResult = profile.dimensionResults.uncertainty_activation
  const regulationResult = profile.dimensionResults.uncertainty_regulation
  if (activationResult.resultStatus !== 'INSUFFICIENT' && !FIVE_ZONE_STATES.concat(THREE_ZONE_STATES).includes(activationResult.state)) fail('dimensionResults.uncertainty_activation.state is invalid')
  if (regulationResult.resultStatus !== 'INSUFFICIENT' && !UNCERTAINTY_REGULATION_STATES.includes(regulationResult.state)) fail('dimensionResults.uncertainty_regulation.state is invalid')
  if (regulationResult.secondaryState !== undefined && regulationResult.secondaryState !== null) {
    if (!UNCERTAINTY_REGULATION_STATES.includes(regulationResult.secondaryState)) fail('dimensionResults.uncertainty_regulation.secondaryState is invalid')
    if (regulationResult.secondaryState === regulationResult.state) fail('dimensionResults.uncertainty_regulation.secondaryState must differ from state')
  }
  const unknownKeys = Object.keys(profile.dimensionResults).filter(key => !DIMENSION_IDS.includes(key))
  if (unknownKeys.length) fail(`unknown dimension results: ${unknownKeys.join(', ')}`)
  assertObject(profile.chapterStates, 'chapterStates')
  CHAPTERS.forEach(chapter => {
    if (!profile.chapterStates[chapter.id]) fail(`chapterStates.${chapter.id} is required`)
    chapter.dimensionIds.forEach(dimensionId => {
      if (!profile.dimensionResults[dimensionId]) fail(`chapter ${chapter.id} is missing ${dimensionId}`)
    })
  })
  const expectedC3 = deriveC3ChapterState(profile.dimensionResults)
  const actualC3 = profile.chapterStates.C3
  const authoredC3Dimensions = c3ChapterRule && c3ChapterRule.dimensions
  const contractC3Dimensions = CHAPTERS.find(chapter => chapter.id === 'C3').dimensionIds
  if (!Array.isArray(authoredC3Dimensions) || authoredC3Dimensions.join('|') !== contractC3Dimensions.join('|')) fail('C3 normative dimensions are out of sync')
  assertObject(actualC3, 'chapterStates.C3')
  if (actualC3.activation !== expectedC3.activation) fail('chapterStates.C3.activation must match uncertainty_activation')
  if (actualC3.primaryStrategy !== expectedC3.primaryStrategy) fail('chapterStates.C3.primaryStrategy must match uncertainty_regulation')
  if ((actualC3.secondaryStrategy || null) !== (expectedC3.secondaryStrategy || null)) fail('chapterStates.C3.secondaryStrategy must match uncertainty_regulation.secondaryState')
  if (profile.summaryPatternIds !== undefined) fail('summaryPatternIds is deprecated; use expectedPatternIds for synthetic expectations only')
  if (profile.expectedPatternIds !== undefined && !Array.isArray(profile.expectedPatternIds)) fail('expectedPatternIds must be an array')
  assertObject(profile.patternContext, 'patternContext')
  if (typeof profile.patternContext.supportNeedKnown !== 'boolean') fail('patternContext.supportNeedKnown must be boolean')
  if (typeof profile.patternContext.majorConstraintConflict !== 'boolean') fail('patternContext.majorConstraintConflict must be boolean')
  if (profile.patternContext.pressure !== undefined && !THREE_ZONE_STATES.includes(profile.patternContext.pressure)) fail('patternContext.pressure is invalid')
  if (profile.patternContext.autonomous !== undefined && !THREE_ZONE_STATES.includes(profile.patternContext.autonomous)) fail('patternContext.autonomous is invalid')
  if (!Array.isArray(profile.unknowns)) fail('unknowns must be an array')
  if (!Array.isArray(profile.interviewPriorities)) fail('interviewPriorities must be an array')
  assertObject(profile.decisionMap, 'decisionMap')
  return true
}

function createDerivedV3Profile(input) {
  const source = input && input.source ? input.source : 'synthetic_fixture'
  const profile = clone(Object.assign({
    contractVersion: 'v3.derived-profile.v1.0',
    source,
    isSynthetic: source === 'synthetic_fixture',
    expectedPatternIds: [],
    unknowns: [],
    interviewPriorities: []
  }, input || {}))
  profile.chapterStates = Object.assign({}, profile.chapterStates, { C3: deriveC3ChapterState(profile.dimensionResults) })
  assertDerivedV3Profile(profile)
  return profile
}

function chapterForDimension(dimensionId) {
  return CHAPTERS.find(chapter => chapter.dimensionIds.includes(dimensionId)) || null
}

module.exports = {
  DIMENSION_IDS,
  CHAPTERS,
  CONFIDENCE_LEVELS,
  EVIDENCE_STATUSES,
  EVIDENCE_ROLES,
  FIVE_ZONE_STATES,
  THREE_ZONE_STATES,
  UNCERTAINTY_REGULATION_STATES,
  createDerivedV3Profile,
  assertDerivedV3Profile,
  deriveC3ChapterState,
  chapterForDimension,
  clone
}
