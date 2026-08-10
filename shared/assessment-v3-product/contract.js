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

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function fail(message) {
  throw new Error(`Invalid DerivedV3Profile: ${message}`)
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object`)
}

function assertDerivedV3Profile(profile) {
  assertObject(profile, 'profile')
  if (profile.contractVersion !== 'v3.derived-profile.v1.0') fail('contractVersion is unsupported')
  if (!['synthetic_fixture', 'calibrated_production'].includes(profile.source)) fail('source is unsupported')
  if (profile.source === 'synthetic_fixture' && profile.isSynthetic !== true) fail('synthetic_fixture must be marked synthetic')
  if (profile.source === 'calibrated_production' && profile.isSynthetic === true) fail('calibrated_production cannot be marked synthetic')
  assertObject(profile.assessmentMeta, 'assessmentMeta')
  if (!profile.assessmentMeta.assessmentId) fail('assessmentMeta.assessmentId is required')
  assertObject(profile.dimensionResults, 'dimensionResults')
  const dimensionKeys = Object.keys(profile.dimensionResults)
  if (dimensionKeys.length !== DIMENSION_IDS.length) fail(`expected ${DIMENSION_IDS.length} dimension results`)
  DIMENSION_IDS.forEach(dimensionId => {
    const result = profile.dimensionResults[dimensionId]
    assertObject(result, `dimensionResults.${dimensionId}`)
    if (!result.state) fail(`dimensionResults.${dimensionId}.state is required`)
    if (!CONFIDENCE_LEVELS.includes(result.confidence)) fail(`dimensionResults.${dimensionId}.confidence is invalid`)
    if (result.evidenceStatus && !EVIDENCE_STATUSES.includes(result.evidenceStatus)) fail(`dimensionResults.${dimensionId}.evidenceStatus is invalid`)
    if (result.evidence && !Array.isArray(result.evidence)) fail(`dimensionResults.${dimensionId}.evidence must be an array`)
    ;(result.evidence || []).forEach((entry, index) => {
      assertObject(entry, `dimensionResults.${dimensionId}.evidence[${index}]`)
      if (!entry.taskId) fail(`dimensionResults.${dimensionId}.evidence[${index}].taskId is required`)
      if (entry.role && !EVIDENCE_ROLES.includes(entry.role)) fail(`dimensionResults.${dimensionId}.evidence[${index}].role is invalid`)
    })
  })
  const unknownKeys = Object.keys(profile.dimensionResults).filter(key => !DIMENSION_IDS.includes(key))
  if (unknownKeys.length) fail(`unknown dimension results: ${unknownKeys.join(', ')}`)
  assertObject(profile.chapterStates, 'chapterStates')
  CHAPTERS.forEach(chapter => {
    if (!profile.chapterStates[chapter.id]) fail(`chapterStates.${chapter.id} is required`)
    chapter.dimensionIds.forEach(dimensionId => {
      if (!profile.dimensionResults[dimensionId]) fail(`chapter ${chapter.id} is missing ${dimensionId}`)
    })
  })
  if (!Array.isArray(profile.summaryPatternIds)) fail('summaryPatternIds must be an array')
  if (profile.summaryPatternIds.length > 3) fail('summaryPatternIds cannot exceed three')
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
    summaryPatternIds: [],
    unknowns: [],
    interviewPriorities: []
  }, input || {}))
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
  createDerivedV3Profile,
  assertDerivedV3Profile,
  chapterForDimension,
  clone
}
