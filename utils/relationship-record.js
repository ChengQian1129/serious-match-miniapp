const {
  EXPLORATION_VERSION,
  LEGACY_EXPLORATION_VERSION,
  buildExplorationResult,
  hasCompleteAnswers,
  questionSetForAnswers
} = require('./exploration')
const { RESPONSE_SCALES, getModule, getItem } = require('./questionnaire-definitions')
const { latestAnswers } = require('./questionnaire-record')
const { GOALS, SETTLEMENT_PLANS, CHILD_PLANS, DISTRICTS } = require('./constants')

const RECORD_SCHEMA_VERSION = 'record-1.0'
const LEGACY_CLAIM_IDS = [
  'exploration.relationship_progression',
  'exploration.contact_and_response',
  'exploration.conflict_handling'
]
const CURRENT_CLAIM_ID = 'exploration.preliminary'
const QUESTIONNAIRE_CLAIM_IDS = [
  'current_relationship_readiness.readiness_intent',
  'current_relationship_readiness.available_capacity',
  'current_relationship_readiness.early_uncertainty',
  'current_relationship_readiness.autonomous_motivation',
  'intimate_interaction_style.uncertainty_sensitivity',
  'intimate_interaction_style.closeness_discomfort',
  'intimate_interaction_style.reg01',
  'intimate_interaction_style.reg02',
  'intimate_interaction_style.reg03',
  'intimate_interaction_style.reg04',
  'needs_and_provision.contact_rhythm',
  'needs_and_provision.response_predictability',
  'needs_and_provision.emotional_support',
  'needs_and_provision.autonomy_space',
  'needs_and_provision.conflict_pause',
  'needs_and_provision.repair_reengagement'
]
const CLAIM_IDS = [CURRENT_CLAIM_ID].concat(LEGACY_CLAIM_IDS, QUESTIONNAIRE_CLAIM_IDS)

function optionLabel(options, value) {
  const option = options.find(item => item.value === value)
  return option ? option.label : ''
}

function buildFacts(profile) {
  if (!profile || !profile.createdAt) return []
  const basic = profile.basic || {}
  const relationship = profile.relationship || {}
  const facts = []

  if (relationship.goal) {
    facts.push({
      id: 'fact.relationship_goal',
      label: '当前关系意愿',
      text: optionLabel(GOALS, relationship.goal),
      sourceType: 'self_report',
      sourceLabel: '个人档案 · 本人填写',
      sourceIds: ['relationship.goal'],
      status: 'stated',
      statusLabel: '本人填写',
      updatedAt: profile.updatedAt
    })
  }

  if (relationship.settlementPlan) {
    facts.push({
      id: 'fact.settlement_plan',
      label: '城市计划',
      text: optionLabel(SETTLEMENT_PLANS, relationship.settlementPlan),
      sourceType: 'self_report',
      sourceLabel: '个人档案 · 本人填写',
      sourceIds: ['relationship.settlementPlan'],
      status: 'stated',
      statusLabel: '本人填写',
      updatedAt: profile.updatedAt
    })
  }

  if (basic.district) {
    facts.push({
      id: 'fact.current_district',
      label: '当前生活区域',
      text: optionLabel(DISTRICTS, basic.district),
      sourceType: 'self_report',
      sourceLabel: '个人档案 · 本人填写',
      sourceIds: ['basic.district'],
      status: 'stated',
      statusLabel: '本人填写',
      updatedAt: profile.updatedAt
    })
  }

  if (relationship.childPlan && relationship.childPlan !== 'skip') {
    facts.push({
      id: 'fact.child_plan',
      label: '关于孩子',
      text: optionLabel(CHILD_PLANS, relationship.childPlan),
      sourceType: 'self_report',
      sourceLabel: '个人档案 · 本人填写',
      sourceIds: ['relationship.childPlan'],
      status: 'stated',
      statusLabel: '本人填写',
      updatedAt: profile.updatedAt
    })
  }

  return facts
}

function buildEvidence(questionIds, answers) {
  const questions = questionSetForAnswers(answers)
  return questionIds.map(questionId => {
    const question = questions.find(item => item.id === questionId)
    const answer = question && question.options.find(item => item.value === answers[questionId])
    return {
      questionId,
      question: question ? question.title : questionId,
      answer: answer ? answer.label : ''
    }
  })
}

function feedbackFor(feedback, claimId) {
  const item = feedback && feedback.claims && feedback.claims[claimId]
  return item && item.value ? item : { value: 'unreviewed', updatedAt: 0 }
}

function feedbackLabel(value) {
  const labels = {
    fits: '你认为符合',
    unsure: '你还不确定',
    not_fits: '你认为不太符合'
  }
  return labels[value] || ''
}

function responseLabel(item, value) {
  const scale = item && RESPONSE_SCALES[item.scaleId]
  const index = scale ? scale.values.indexOf(value) : -1
  return index >= 0 ? scale.labels[index] : ''
}

function claim(claimId, label, title, text, questionIds, exploration, feedback, options = {}) {
  const review = feedbackFor(feedback, claimId)
  return {
    id: claimId,
    label,
    title,
    text,
    sourceType: 'exploration_response',
    sourceLabel: options.sourceLabel || '4 题初步探索',
    sourceIds: questionIds,
    evidence: buildEvidence(questionIds, exploration.answers),
    ruleVersion: options.ruleVersion || `exploration-${exploration.version}`,
    status: options.status || 'preliminary',
    statusLabel: options.statusLabel || '初步判断',
    feedback: review.value,
    feedbackLabel: feedbackLabel(review.value),
    feedbackUpdatedAt: review.updatedAt,
    updatedAt: exploration.completedAt || exploration.updatedAt
  }
}

function buildClaims(exploration, feedback) {
  if (!exploration || !hasCompleteAnswers(exploration.answers)) return []
  const result = exploration.result || buildExplorationResult(exploration.answers)
  if (!result) return []

  if (result.version === EXPLORATION_VERSION && result.claim) {
    return [claim(
      CURRENT_CLAIM_ID,
      result.claim.confidenceState === 'direct_fact' ? '你的明确选择' : '初步观察',
      result.title,
      result.intro,
      result.claim.supportingQuestionIds,
      exploration,
      feedback,
      {
        sourceLabel: '5 题初步探索',
        status: result.claim.confidenceState,
        statusLabel: result.claim.confidenceState === 'direct_fact' ? '本人选择' : '初步判断'
      }
    )]
  }

  if (result.version !== LEGACY_EXPLORATION_VERSION) return []
  return [
    claim(
      LEGACY_CLAIM_IDS[0],
      '关系推进',
      result.title,
      result.intro,
      ['relationship_progression'],
      exploration,
      feedback
    ),
    claim(
      LEGACY_CLAIM_IDS[1],
      '联系与回应',
      '你偏好的联系与支持方式',
      result.sections[0].text,
      ['contact_frequency', 'emotional_response'],
      exploration,
      feedback
    ),
    claim(
      LEGACY_CLAIM_IDS[2],
      '分歧之后',
      '你希望怎样处理不愉快',
      result.sections[1].text,
      ['conflict_handling'],
      exploration,
      feedback
    )
  ]
}

function buildQuestionnaireClaims(questionnaireData, feedback) {
  if (!questionnaireData || !questionnaireData.modules) return []
  const claims = []

  Object.keys(questionnaireData.modules).forEach(moduleId => {
    const moduleRecord = questionnaireData.modules[moduleId]
    const module = getModule(moduleId)
    if (!module || !moduleRecord || moduleRecord.status !== 'complete' || !moduleRecord.evaluation) return
    const answers = latestAnswers(moduleRecord)

    ;(moduleRecord.evaluation.claims || []).forEach(sourceClaim => {
      const dimension = module.dimensions.find(item => item.id === sourceClaim.subjectArea)
      const observation = (moduleRecord.evaluation.observations || []).find(item => item.constructId === sourceClaim.subjectArea)
      const sourceIds = observation && observation.sourceItemIds && observation.sourceItemIds.length
        ? observation.sourceItemIds
        : sourceClaim.supportingItemIds.concat(sourceClaim.contradictingItemIds || [])
      const review = feedbackFor(feedback, sourceClaim.claimId)
      const statusLabels = {
        multi_item_supported: '多题支持',
        initial: '初步判断',
        direct_fact: '本人选择'
      }
      claims.push({
        id: sourceClaim.claimId,
        label: dimension ? dimension.title : '关系探索',
        title: sourceClaim.userFacingText,
        text: `这段描述只来自“${module.title}”中对应维度的回答，不代表总分或人格类型。`,
        sourceType: 'questionnaire_response',
        sourceLabel: `${module.title} · ${sourceClaim.evidenceCount} 项依据`,
        sourceIds,
        evidence: sourceIds.map(itemId => {
          const item = getItem(itemId)
          return {
            questionId: itemId,
            question: item ? item.text : itemId,
            answer: responseLabel(item, answers[itemId])
          }
        }),
        ruleVersion: sourceClaim.scoringRuleVersion,
        status: sourceClaim.confidenceState,
        statusLabel: statusLabels[sourceClaim.confidenceState] || '初步判断',
        feedback: review.value,
        feedbackLabel: feedbackLabel(review.value),
        feedbackUpdatedAt: review.updatedAt,
        updatedAt: moduleRecord.updatedAt
      })
    })
  })

  return claims
}

function buildRelationshipRecord(profile, exploration, feedback, questionnaireData) {
  const facts = buildFacts(profile)
  const claims = buildClaims(exploration, feedback).concat(buildQuestionnaireClaims(questionnaireData, feedback))
  const readiness = questionnaireData && questionnaireData.modules && questionnaireData.modules.current_relationship_readiness
  const interaction = questionnaireData && questionnaireData.modules && questionnaireData.modules.intimate_interaction_style
  const needs = questionnaireData && questionnaireData.modules && questionnaireData.modules.needs_and_provision
  let openQuestions
  if (!readiness || readiness.status !== 'complete') {
    openQuestions = [{
      id: 'open.current_readiness',
      label: '仍需要了解',
      title: '你现在是否真的有余力开始一段关系？',
      text: '关系意愿、现实投入和外部压力需要分开了解，目前还没有足够依据。'
    }]
  } else if (!interaction || interaction.status !== 'complete') {
    openQuestions = [{
      id: 'open.interaction_style',
      label: '仍需要了解',
      title: '关系靠近或不明确时，你通常怎样回应？',
      text: '目前知道你是否准备好开始，还不了解亲近、不确定和压力出现时的实际反应。'
    }]
  } else if (!needs || needs.status !== 'complete') {
    openQuestions = [{
      id: 'open.needs_and_provision',
      label: '仍需要了解',
      title: '你需要怎样的相处，也能稳定提供什么？',
      text: '需要和能够提供是两件事，后续会分别留下依据。'
    }]
  } else {
    openQuestions = []
  }
  const timestamps = facts.concat(claims).map(item => Number(item.updatedAt) || 0)
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    facts,
    claims,
    openQuestions,
    updatedAt: Math.max(0, ...timestamps)
  }
}

module.exports = {
  RECORD_SCHEMA_VERSION,
  CLAIM_IDS,
  buildRelationshipRecord,
  feedbackLabel
}
