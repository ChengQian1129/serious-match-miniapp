const { createDerivedV3Profile, DIMENSION_IDS } = require('./contract')

const EVIDENCE = Object.freeze({
  relationship_readiness: [
    { taskId: 'RR01', answerCode: '6', role: 'supporting' },
    { taskId: 'RR04', answerCode: '3', role: 'qualifying' }
  ],
  initiation_motivation: [{ taskId: 'IM-IN01', answerCode: '6' }],
  available_capacity: [{ taskId: 'CAP01', answerCode: '3' }],
  relational_follow_through: [{ taskId: 'FT01', answerCode: '4' }],
  uncertainty_activation: [{ taskId: 'UA01', answerCode: '6' }],
  uncertainty_regulation: [
    { taskId: 'UR-DC01', answerCode: '4', role: 'supporting' },
    { taskId: 'UR-RS01', answerCode: '3', role: 'qualifying' }
  ],
  intimacy_dependence_comfort: [{ taskId: 'IDC01', answerCode: '5' }],
  personal_space_need: [{ taskId: 'PS01', answerCode: '3' }],
  support_need: [{ taskId: 'SN01', answerCode: '6' }],
  support_signaling: [
    { taskId: 'SS01', answerCode: '3', role: 'supporting' },
    { taskId: 'SS02', answerCode: '2', role: 'contradicting' }
  ],
  responsiveness_capability: [{ taskId: 'RC01', answerCode: '4' }],
  conflict_activation: [{ taskId: 'CA01', answerCode: '6' }],
  conflict_pacing_need: [{ taskId: 'CP01', answerCode: '3' }],
  repair_reengagement: [{ taskId: 'CR01', answerCode: '4' }]
})

const BASE_DIMENSIONS = Object.freeze({
  relationship_readiness: { state: 'HIGH', confidence: 'HIGH' },
  initiation_motivation: { state: 'AUTONOMOUS_DOMINANT', confidence: 'HIGH' },
  available_capacity: { state: 'HIGH', confidence: 'MEDIUM' },
  relational_follow_through: { state: 'HIGH', confidence: 'MEDIUM' },
  uncertainty_activation: { state: 'MID', confidence: 'MEDIUM' },
  uncertainty_regulation: { state: 'CLARIFYING', confidence: 'MEDIUM' },
  intimacy_dependence_comfort: { state: 'HIGH', confidence: 'MEDIUM' },
  personal_space_need: { state: 'HIGH', confidence: 'HIGH' },
  support_need: { state: 'LISTEN_VALIDATE', confidence: 'MEDIUM' },
  support_signaling: { state: 'HIGH', confidence: 'MEDIUM' },
  responsiveness_capability: { state: 'MID', confidence: 'LOW', evidenceStatus: 'PROVISIONAL' },
  conflict_activation: { state: 'MID', confidence: 'MEDIUM' },
  conflict_pacing_need: { state: 'SHORT_PAUSE', confidence: 'MEDIUM' },
  repair_reengagement: { state: 'HIGH', confidence: 'LOW', evidenceStatus: 'PROVISIONAL' }
})

const BASE_CHAPTERS = Object.freeze({
  C1: 'READY_SELF_DRIVEN',
  C2: 'HIGH_HIGH',
  C3: 'CLARIFYING',
  C4: 'HIGH_HIGH',
  C5: 'BALANCED',
  C6: 'MID_FLEX_HIGH'
})

const BASE_DECISION_MAP = Object.freeze({
  l3: { items: [{ copyKey: 'contact', valueKey: 'steady' }, { copyKey: 'time', valueKey: 'space' }, { copyKey: 'conflict', valueKey: 'return' }] },
  l4: { items: [{ copyKey: 'ideal', valueKey: 'natural' }, { copyKey: 'acceptable', valueKey: 'talk' }, { copyKey: 'priority', valueKey: 'explicit' }, { copyKey: 'tradeoff', valueKey: 'weigh' }, { copyKey: 'boundary', valueKey: 'self_defined' }] },
  l5: { items: [{ copyKey: 'desire', valueKey: 'clear' }, { copyKey: 'intention', valueKey: 'some' }, { copyKey: 'feasibility', valueKey: 'separate' }, { copyKey: 'constraint', valueKey: 'talk_early' }] }
})

const BASE_UNKNOWNS = Object.freeze(['realInteraction', 'partnerResponse', 'lifeChange'])

const BASE_INTERVIEW_PRIORITIES = Object.freeze([
  { copyKey: 'realInteraction', dimensionId: 'uncertainty_regulation' },
  { copyKey: 'supportPattern', dimensionId: 'support_signaling' },
  { copyKey: 'repairInPractice', dimensionId: 'repair_reengagement' }
])

function decisionMapWithValues(overrides = {}) {
  return Object.fromEntries(Object.entries(BASE_DECISION_MAP).map(([sectionId, section]) => [
    sectionId,
    { items: section.items.map(item => Object.assign({}, item, overrides[sectionId] && overrides[sectionId][item.copyKey] ? { valueKey: overrides[sectionId][item.copyKey] } : {})) }
  ]))
}

function mergeDimensionResults(overrides = {}) {
  return Object.fromEntries(DIMENSION_IDS.map(dimensionId => [
    dimensionId,
    Object.assign({}, BASE_DIMENSIONS[dimensionId], { evidence: EVIDENCE[dimensionId] }, overrides[dimensionId] || {})
  ]))
}

function createFixture(id, labelKey, descriptionKey, overrides = {}) {
  return createDerivedV3Profile({
    assessmentMeta: {
      assessmentId: `preview.${id}`,
      assessedAt: '2026-08-10T00:00:00.000Z',
      scoringModelVersion: 'synthetic-fixture',
      authoringLibraryVersion: 'v1.0',
      reportVersion: 'v3-preview.1',
      pilotStatus: 'preview_only'
    },
    persona: { id, labelKey, descriptionKey },
    dimensionResults: mergeDimensionResults(overrides.dimensionResults),
    chapterStates: Object.assign({}, BASE_CHAPTERS, overrides.chapterStates || {}),
    summaryPatternIds: overrides.summaryPatternIds || ['INTIMACY_HIGH_SPACE_HIGH', 'SUPPORT_NEED_SIGNAL_GAP', 'CONFLICT_HIGH_REPAIR_HIGH'],
    decisionMap: overrides.decisionMap || BASE_DECISION_MAP,
    unknowns: overrides.unknowns || BASE_UNKNOWNS,
    interviewPriorities: overrides.interviewPriorities || BASE_INTERVIEW_PRIORITIES
  })
}

const FIXTURES = Object.freeze([
  createFixture('ready_self', 'ready_self', 'ready_self'),
  createFixture('ready_busy', 'ready_busy', 'ready_busy', {
    dimensionResults: { available_capacity: { state: 'LOW', confidence: 'HIGH' } },
    chapterStates: { C2: 'LOW_HIGH' },
    summaryPatternIds: ['READINESS_CAPACITY_GAP', 'CAPACITY_SPACE_DISTINCT'],
    decisionMap: decisionMapWithValues({ l3: { time: 'busy' }, l5: { feasibility: 'tight' } })
  }),
  createFixture('pressured_busy', 'pressured_busy', 'pressured_busy', {
    dimensionResults: {
      relationship_readiness: { state: 'LOW', confidence: 'MEDIUM' },
      initiation_motivation: { state: 'PRESSURE_DOMINANT', confidence: 'MEDIUM' },
      available_capacity: { state: 'LOW', confidence: 'HIGH' }
    },
    chapterStates: { C1: 'PRESSURED_NOT_READY', C2: 'LOW_MID' },
    summaryPatternIds: ['PRESSURE_CAPACITY_GAP', 'AUTONOMOUS_READINESS_CONSTRAINT']
  }),
  createFixture('followthrough_gap', 'followthrough_gap', 'followthrough_gap', {
    dimensionResults: {
      relational_follow_through: { state: 'LOW', confidence: 'HIGH' },
      repair_reengagement: { state: 'LOW', confidence: 'LOW', evidenceStatus: 'PROVISIONAL' }
    },
    chapterStates: { C2: 'HIGH_LOW', C6: 'MID_ANY_LOW' },
    summaryPatternIds: ['HIGH_READINESS_LOW_FOLLOWTHROUGH', 'FOLLOWTHROUGH_REPAIR_LINK'],
    decisionMap: decisionMapWithValues({ l3: { conflict: 'unfinished' }, l5: { intention: 'observe' } })
  }),
  createFixture('direct_clarifier', 'direct_clarifier', 'direct_clarifier', {
    dimensionResults: { uncertainty_activation: { state: 'HIGH', confidence: 'HIGH' } },
    chapterStates: { C3: 'CLARIFYING' },
    summaryPatternIds: ['HIGH_ACTIVATION_REASSURANCE']
  }),
  createFixture('high_activation_quiet', 'high_activation_quiet', 'high_activation_quiet', {
    dimensionResults: {
      uncertainty_activation: { state: 'HIGH', confidence: 'HIGH' },
      uncertainty_regulation: { state: 'REASSURANCE_ORIENTED', confidence: 'MEDIUM' },
      support_signaling: { state: 'LOW', confidence: 'MEDIUM' }
    },
    chapterStates: { C3: 'REASSURANCE_ORIENTED', C5: 'NEED_CLEAR_SIGNAL_LOW' },
    summaryPatternIds: ['HIGH_ACTIVATION_LOW_SIGNAL', 'SUPPORT_NEED_SIGNAL_GAP']
  }),
  createFixture('close_with_space', 'close_with_space', 'close_with_space', {
    dimensionResults: { intimacy_dependence_comfort: { state: 'HIGH', confidence: 'HIGH' }, personal_space_need: { state: 'HIGH', confidence: 'HIGH' } },
    chapterStates: { C4: 'HIGH_HIGH' },
    summaryPatternIds: ['INTIMACY_HIGH_SPACE_HIGH', 'SPACE_PACING_SHARED']
  }),
  createFixture('self_reliant', 'self_reliant', 'self_reliant', {
    dimensionResults: {
      intimacy_dependence_comfort: { state: 'LOW', confidence: 'MEDIUM' },
      support_signaling: { state: 'LOW', confidence: 'HIGH' },
      responsiveness_capability: { state: 'HIGH', confidence: 'LOW', evidenceStatus: 'PROVISIONAL' }
    },
    chapterStates: { C4: 'LOW_HIGH', C5: 'RESPONSIVE_SELF_SILENT' },
    summaryPatternIds: ['INTIMACY_LOW_SUPPORT_SIGNAL_LOW', 'RESPONSIVE_SELF_SILENT']
  }),
  createFixture('support_specific', 'support_specific', 'support_specific', {
    dimensionResults: {
      support_need: { state: 'PROBLEM_SOLVING', confidence: 'HIGH' },
      support_signaling: { state: 'HIGH', confidence: 'HIGH' },
      responsiveness_capability: { state: 'MID', confidence: 'LOW', evidenceStatus: 'PROVISIONAL' }
    },
    chapterStates: { C5: 'PROBLEM_SOLVING_MISMATCH_RISK' },
    summaryPatternIds: ['SUPPORT_NEED_SIGNAL_GAP']
  }),
  createFixture('conflict_return', 'conflict_return', 'conflict_return', {
    dimensionResults: {
      conflict_activation: { state: 'HIGH', confidence: 'HIGH' },
      conflict_pacing_need: { state: 'SHORT_PAUSE', confidence: 'HIGH' },
      repair_reengagement: { state: 'HIGH', confidence: 'MEDIUM', evidenceStatus: 'PROVISIONAL' }
    },
    chapterStates: { C6: 'HIGH_SHORT_HIGH' },
    summaryPatternIds: ['CONFLICT_HIGH_REPAIR_HIGH', 'SPACE_PACING_SHARED']
  }),
  createFixture('quiet_unrepaired', 'quiet_unrepaired', 'quiet_unrepaired', {
    dimensionResults: {
      conflict_activation: { state: 'LOW', confidence: 'MEDIUM' },
      conflict_pacing_need: { state: 'FLEXIBLE', confidence: 'LOW' },
      repair_reengagement: { state: 'LOW', confidence: 'LOW', evidenceStatus: 'PROVISIONAL' }
    },
    chapterStates: { C6: 'LOW_ANY_LOW' },
    summaryPatternIds: ['CONFLICT_LOW_REPAIR_LOW'],
    decisionMap: decisionMapWithValues({ l3: { conflict: 'unfinished' }, l5: { feasibility: 'tight' } })
  }),
  createFixture('mixed_context', 'mixed_context', 'mixed_context', {
    dimensionResults: {
      relationship_readiness: { state: 'MID', confidence: 'LOW' },
      initiation_motivation: { state: 'MIXED', confidence: 'LOW' },
      uncertainty_regulation: { state: 'MIXED', confidence: 'LOW' },
      intimacy_dependence_comfort: { state: 'MID', confidence: 'LOW' }
    },
    chapterStates: { C1: 'WANT_BUT_NOT_READY', C3: 'MIXED', C4: 'MID_MID' },
    summaryPatternIds: ['AUTONOMOUS_READINESS_CONSTRAINT'],
    decisionMap: decisionMapWithValues({ l3: { time: 'shared' }, l5: { desire: 'open', intention: 'observe' } })
  })
])

function getFixture(id) {
  return FIXTURES.find(fixture => fixture.persona.id === id) || FIXTURES[0]
}

function listFixtures() {
  return FIXTURES.slice()
}

module.exports = { FIXTURES, getFixture, listFixtures, EVIDENCE }
