const {
  QUESTIONNAIRE_SCHEMA_VERSION,
  RESPONSE_SCALES,
  getModule
} = require('./questionnaire-definitions')

const SCORING_RULE_VERSION = 'questionnaire-rules-0.1.0'
const REPORT_TEMPLATE_VERSION = 'questionnaire-report-0.1.0'

const reflectiveCopy = {
  readiness_intent: {
    present: '你现在愿意认真开始一段以长期相处为方向的关系。',
    less: '你现在可能更想维持单身或原有生活安排。',
    mixed: '你对开始一段关系既有意愿，也有一些希望保留现状的考虑。'
  },
  available_capacity: {
    present: '你目前在时间、情绪和基本联系上有一定余力认识一个人。',
    less: '你目前的时间或情绪余力可能比较有限。',
    mixed: '你有投入关系的空间，但现实安排可能影响持续联系。'
  },
  early_uncertainty: {
    present: '在关系还不明确时，你通常能先观察、沟通并给了解留出时间。',
    less: '关系短期没有明确答案时，你可能更倾向尽快退出。',
    mixed: '你愿意继续了解，但不确定持续时也可能较快想要答案。'
  },
  autonomous_motivation: {
    present: '你现在认识新的人，主要来自自己的愿望和选择。',
    less: '外部催促或现实压力可能是你这次登记的重要推动力。',
    mixed: '你既有自己的关系愿望，也受到一些外部压力影响。'
  },
  uncertainty_sensitivity: {
    present: '当回应变化或关系还未明确时，你可能更快注意到距离感，也更需要清楚回应。',
    less: '面对一两次联系变化时，你通常能等到有更多信息再判断。',
    mixed: '你有时能容纳联系变化，有些情境下也会很快感到不安。'
  },
  closeness_discomfort: {
    present: '关系变亲近或需要相互依赖时，你有时会更想自己处理并保留距离。',
    less: '你通常能够接受相互依赖，也比较能表达自己的需要和脆弱。',
    mixed: '你能接受一些亲近和依赖，但在暴露脆弱或持续靠近时可能有所保留。'
  }
}

const observationCopy = {
  REG01: '感到关系不稳时，你可能会通过连续确认、反复发消息或追问来寻找答案。',
  REG02: '关系有压力时，你可能会减少回应、搁置话题或暂时拉开距离。',
  REG03: '你通常能够直接表达自己的不安和希望得到的回应。',
  REG04: '需要暂停时，你通常能够说明原因和大概何时再聊。'
}

function round(value) {
  return Math.round(value * 100) / 100
}

function isMissing(value) {
  return value === undefined || value === null || value === '' || value === 'NA' || value === 'SKIP'
}

function answerMap(module, answers) {
  const source = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {}
  const clean = {}

  module.items.forEach(item => {
    if (!(item.id in source)) return
    const value = source[item.id]
    const scale = RESPONSE_SCALES[item.scaleId]
    if (!scale.values.includes(value)) throw new Error(`回答 ${item.id} 不在量尺 ${item.scaleId} 的允许范围内`)
    clean[item.id] = value
  })

  return clean
}

function scoredValue(item, rawValue) {
  if (isMissing(rawValue)) return null
  return item.reverseScored ? 6 - rawValue : rawValue
}

function evidenceState(validCount, minimum, supportingCount, contradictingCount) {
  if (validCount < minimum) return { confidenceState: 'insufficient_evidence', direction: 'insufficient' }
  if (supportingCount >= 3 && contradictingCount === 0) {
    return { confidenceState: 'multi_item_supported', direction: 'present' }
  }
  if (contradictingCount >= 3 && supportingCount === 0) {
    return { confidenceState: 'multi_item_supported', direction: 'less' }
  }
  if (supportingCount > 0 && contradictingCount > 0) {
    return { confidenceState: 'initial', direction: 'mixed' }
  }
  return { confidenceState: 'initial', direction: 'unclear' }
}

function buildClaim(module, dimension, observation, evaluatedAt) {
  const copy = reflectiveCopy[dimension.id]
  if (!copy || ['insufficient', 'unclear'].includes(observation.direction)) return null
  return {
    claimId: `${module.id}.${dimension.id}`,
    subjectArea: dimension.id,
    directionOrState: observation.direction,
    userFacingText: copy[observation.direction],
    sourceModuleId: module.id,
    supportingItemIds: observation.supportingItemIds,
    contradictingItemIds: observation.contradictingItemIds,
    itemSetVersion: module.version,
    scoringRuleVersion: SCORING_RULE_VERSION,
    reportTemplateVersion: REPORT_TEMPLATE_VERSION,
    evidenceCount: observation.validCount,
    confidenceState: observation.confidenceState,
    userFeedbackState: 'unreviewed',
    operatorConfirmationState: 'unreviewed',
    generatedAt: evaluatedAt,
    lastReviewedAt: evaluatedAt
  }
}

function evaluateReflective(module, answers, evaluatedAt) {
  const observations = []
  const claims = []

  module.dimensions.filter(dimension => dimension.scoringRole !== 'observation').forEach(dimension => {
    const items = module.items.filter(current => current.dimensionId === dimension.id && current.scoringRole === 'dimension')
    const evidence = items.map(current => ({
      item: current,
      rawValue: answers[current.id],
      value: scoredValue(current, answers[current.id])
    })).filter(current => current.value !== null)
    const supporting = evidence.filter(current => current.value >= 4).map(current => current.item.id)
    const contradicting = evidence.filter(current => current.value <= 2).map(current => current.item.id)
    const neutral = evidence.filter(current => current.value === 3).map(current => current.item.id)
    const state = evidenceState(evidence.length, module.minimumByDimension, supporting.length, contradicting.length)
    const observation = {
      observationId: `${module.id}.${dimension.id}.${evaluatedAt}`,
      constructId: dimension.id,
      title: dimension.title,
      sourceItemIds: evidence.map(current => current.item.id),
      supportingItemIds: supporting,
      contradictingItemIds: contradicting,
      neutralItemIds: neutral,
      validCount: evidence.length,
      requiredCount: module.minimumByDimension,
      computedValueInternal: evidence.length ? round(evidence.reduce((total, current) => total + current.value, 0) / evidence.length) : null,
      confidenceState: state.confidenceState,
      direction: state.direction,
      computedAt: evaluatedAt
    }
    observations.push(observation)
    const claim = buildClaim(module, dimension, observation, evaluatedAt)
    if (claim) claims.push(claim)
  })

  if (module.id === 'intimate_interaction_style') {
    module.items.filter(current => current.scoringRole === 'observation').forEach(current => {
      const value = answers[current.id]
      if (isMissing(value) || value < 4) return
      claims.push({
        claimId: `${module.id}.${current.id.toLowerCase()}`,
        subjectArea: 'interaction_regulation',
        directionOrState: 'direct_behavior',
        userFacingText: observationCopy[current.id],
        sourceModuleId: module.id,
        supportingItemIds: [current.id],
        contradictingItemIds: [],
        itemSetVersion: module.version,
        scoringRuleVersion: SCORING_RULE_VERSION,
        reportTemplateVersion: REPORT_TEMPLATE_VERSION,
        evidenceCount: 1,
        confidenceState: 'direct_fact',
        userFeedbackState: 'unreviewed',
        operatorConfirmationState: 'unreviewed',
        generatedAt: evaluatedAt,
        lastReviewedAt: evaluatedAt
      })
    })
  }

  return { observations, claims }
}

function needState(items, answers) {
  const values = items.map(current => scoredValue(current, answers[current.id]))
  if (values.some(value => value === null)) return 'insufficient_evidence'
  if (values.every(value => value >= 4)) return 'need_clear'
  if (values.every(value => value <= 2)) return 'need_lower'
  if (values.every(value => value >= 2 && value <= 3)) return 'need_flexible'
  return 'need_mixed'
}

function provideState(items, answers) {
  const values = items.map(current => answers[current.id])
  if (values.some(isMissing)) return 'provide_uncertain'
  if (values.some(value => value <= 2)) return 'provide_constrained'
  if (values.every(value => value >= 4)) return 'provide_stable'
  return 'provide_variable'
}

const needCopy = {
  need_clear: '这项需要目前比较清楚',
  need_lower: '这项目前不是你的主要需要',
  need_flexible: '你对这项条件比较有弹性',
  need_mixed: '你对这项条件的回答可能取决于具体情境',
  insufficient_evidence: '这项需要目前还没有足够回答'
}

const provideCopy = {
  provide_stable: '你通常也能稳定提供相关行为',
  provide_variable: '你有时能够提供，稳定程度可能随情境变化',
  provide_uncertain: '你是否能持续提供，目前还缺少经验',
  provide_constrained: '你目前可能较难持续提供相关行为'
}

function evaluateNeeds(module, answers, evaluatedAt) {
  const observations = []
  const claims = []

  module.dimensions.forEach(dimension => {
    const items = module.items.filter(current => current.dimensionId === dimension.id)
    const needItems = items.filter(current => current.side === 'need')
    const provideItems = items.filter(current => current.side === 'provide')
    const need = needState(needItems, answers)
    const provide = provideState(provideItems, answers)
    const validNeedIds = needItems.filter(current => !isMissing(answers[current.id])).map(current => current.id)
    const validProvideIds = provideItems.filter(current => !isMissing(answers[current.id])).map(current => current.id)
    const evidenceIds = validNeedIds.concat(validProvideIds)
    const complete = validNeedIds.length === needItems.length && validProvideIds.length === provideItems.length
    const confidenceState = complete ? 'multi_item_supported' : 'initial'

    observations.push({
      observationId: `${module.id}.${dimension.id}.${evaluatedAt}`,
      constructId: dimension.id,
      title: dimension.title,
      sourceItemIds: evidenceIds,
      needState: need,
      provideState: provide,
      confidenceState,
      computedAt: evaluatedAt
    })

    if (!evidenceIds.length) return
    claims.push({
      claimId: `${module.id}.${dimension.id}`,
      subjectArea: dimension.id,
      directionOrState: `${need}+${provide}`,
      userFacingText: `${dimension.title}方面，${needCopy[need]}；${provideCopy[provide]}。`,
      sourceModuleId: module.id,
      supportingItemIds: evidenceIds,
      contradictingItemIds: [],
      itemSetVersion: module.version,
      scoringRuleVersion: SCORING_RULE_VERSION,
      reportTemplateVersion: REPORT_TEMPLATE_VERSION,
      evidenceCount: evidenceIds.length,
      confidenceState,
      userFeedbackState: 'unreviewed',
      operatorConfirmationState: 'unreviewed',
      generatedAt: evaluatedAt,
      lastReviewedAt: evaluatedAt
    })
  })

  return { observations, claims }
}

function evaluateQuestionnaire(moduleId, rawAnswers, options = {}) {
  const module = getModule(moduleId)
  if (!module) throw new Error(`未知问卷模块 ${moduleId}`)
  const answers = answerMap(module, rawAnswers)
  const evaluatedAt = Number(options.evaluatedAt) || Date.now()
  const result = module.id === 'needs_and_provision'
    ? evaluateNeeds(module, answers, evaluatedAt)
    : evaluateReflective(module, answers, evaluatedAt)

  return {
    schemaVersion: QUESTIONNAIRE_SCHEMA_VERSION,
    moduleId: module.id,
    instrumentVersion: module.version,
    scoringRuleVersion: SCORING_RULE_VERSION,
    reportTemplateVersion: REPORT_TEMPLATE_VERSION,
    evaluatedAt,
    observations: result.observations,
    claims: result.claims
  }
}

module.exports = {
  SCORING_RULE_VERSION,
  REPORT_TEMPLATE_VERSION,
  evaluateQuestionnaire,
  scoredValue
}
