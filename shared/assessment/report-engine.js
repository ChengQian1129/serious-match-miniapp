const { ITEMS, DIMENSIONS, INSTRUMENT_VERSION, optionsFor } = require('./schema')
const { evaluateAssessment, SCORING_RULE_VERSION, missing, scored } = require('./scoring-rules')
const { rules, REPORT_RULE_VERSION } = require('./report-rules')
const { CONTENT_VERSION, REPORT_COPY_VERSION } = require('../content/version')
const { resolveClaimCopy } = require('../content/claim-copy')
const publicLanguage = require('../content/public-language.generated')

function readPath(evaluation, path) {
  const parts = path.split('.')
  if (parts[0] === 'observations') return evaluation.observations[parts[1]]
  const dimension = evaluation.dimensions[parts[0]]
  return dimension && dimension[parts[1]]
}

function matches(evaluation, condition) {
  const [path, operator, expected] = condition
  const actual = readPath(evaluation, path)
  return operator === 'in' ? expected.includes(actual) : actual === expected
}

function scoreMatches(mode, value) {
  if (value === null || value === undefined) return false
  if (mode === 'high') return value >= 4
  if (mode === 'low') return value <= 2
  if (mode === 'mid') return value === 3
  if (mode === 'non_high') return value <= 3
  if (mode === 'polarized') return value <= 2 || value >= 4
  return true
}

function selectorItemIds(selector) {
  return selector.itemIds || ITEMS.filter(item => {
    if (item.constructId !== selector.dimension) return false
    if (selector.side && item.side !== selector.side) return false
    return true
  }).map(item => item.id)
}

function selectItemIds(selector, answers) {
  const ids = selectorItemIds(selector)
  return ids.filter(id => {
    const item = ITEMS.find(current => current.id === id)
    if (!item) return false
    const raw = answers[id]
    if (selector.raw) {
      if (missing(raw)) return false
      return selector.raw === 'high' ? Number(raw) >= 4 : selector.raw === 'low' ? Number(raw) <= 2 : true
    }
    if (missing(raw)) return false
    return scoreMatches(selector.scored, scored(item, raw))
  })
}

function itemEvidence(ids, answers, kind) {
  return ids.map(id => {
    const item = ITEMS.find(current => current.id === id)
    if (!item) return null
    const raw = answers[id]
    const option = optionsFor(item).find(current => current.value === raw)
    return {
      itemId: id,
      question: item.publicText || item.text,
      rawValue: raw === undefined ? null : raw,
      scoredValue: missing(raw) ? null : scored(item, raw),
      answer: option ? option.label : '暂未判断',
      kind
    }
  }).filter(Boolean)
}

function confidenceFor(supporting, contradicting, qualifying, qualityStatus) {
  let level = supporting.length >= 3 ? 'strong' : supporting.length >= 2 ? 'moderate' : 'tentative'
  const reasonCodes = []
  if (supporting.length) reasonCodes.push('direct_item_support')
  if (contradicting.length) { reasonCodes.push('contradicting_evidence'); level = 'context_dependent' }
  if (qualifying.length) reasonCodes.push('qualifying_evidence')
  if (qualityStatus === 'limited_evidence') { reasonCodes.push('limited_response_evidence'); level = 'tentative' }
  if (qualityStatus === 'review_recommended') {
    reasonCodes.push('response_quality_review')
    if (level === 'strong') level = 'moderate'
    else if (level === 'moderate') level = 'tentative'
  }
  return { level, reasonCodes }
}

function claimFromSelectors(definition, answers, options = {}) {
  const source = Object.assign({}, definition, resolveClaimCopy(definition))
  const selectors = source.selectors || {}
  const supportIds = [...new Set((selectors.supportSelectors || []).flatMap(selector => selectItemIds(selector, answers)))]
  const contradictionIds = [...new Set((selectors.contradictionSelectors || []).flatMap(selector => selectItemIds(selector, answers)))]
  const qualificationIds = [...new Set((selectors.qualificationSelectors || []).flatMap(selector => selectItemIds(selector, answers)))].filter(id => !supportIds.includes(id) && !contradictionIds.includes(id))
  const referencedIds = [...new Set([].concat(selectors.supportSelectors || [], selectors.contradictionSelectors || [], selectors.qualificationSelectors || []).flatMap(selectorItemIds))]
  const missingIds = referencedIds.filter(id => missing(answers[id]))
  const confidence = confidenceFor(supportIds, contradictionIds, qualificationIds, options.qualityStatus)
  return Object.assign({}, source, {
    claimId: source.id,
    statement: source.text,
    supportingItemIds: supportIds,
    contradictingItemIds: contradictionIds,
    qualifyingItemIds: qualificationIds,
    missingItemIds: missingIds,
    evidence: {
      supporting: itemEvidence(supportIds, answers, 'supporting'),
      contradicting: itemEvidence(contradictionIds, answers, 'contradicting'),
      qualifying: itemEvidence(qualificationIds, answers, 'qualifying'),
      missing: itemEvidence(missingIds, answers, 'missing')
    },
    confidence,
    confidenceState: confidence.level,
    instrumentVersion: INSTRUMENT_VERSION,
    scoringRuleVersion: SCORING_RULE_VERSION,
    reportRuleVersion: REPORT_RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    reportCopyVersion: REPORT_COPY_VERSION,
    generatedAt: Number(options.generatedAt) || Date.now()
  })
}

function reflectiveSelectors(dimension, state) {
  const scoredMode = state === 'strong_less' || state === 'lean_less' ? 'low' : state === 'mixed' ? 'polarized' : 'high'
  return {
    supportSelectors: [{ dimension, scored: scoredMode }],
    contradictionSelectors: [{ dimension, scored: scoredMode === 'high' ? 'low' : 'high' }],
    qualificationSelectors: [{ dimension, scored: 'mid' }]
  }
}

function fallbackClaims(evaluation, answers, options) {
  const stateCopy = {
    strong_present: '这几道题的回答比较一致，可以先这样理解。',
    lean_present: '这几道题的回答大多指向这个方向。',
    strong_less: '这几道题的回答大多指向另一个方向。',
    lean_less: '这几道题的回答暂时不太支持这个方向。',
    mixed: '不同情境下的回答不完全一样，先保留一点空间。'
  }
  return Object.values(evaluation.dimensions).filter(dimension => dimension.kind === 'reflective' && stateCopy[dimension.state]).map(dimension => claimFromSelectors({
    id: 'DIM_' + dimension.id,
    section: dimension.id === 'readiness_intent' || dimension.id === 'available_capacity' ? 'overall' : 'interaction',
    title: '这一部分现在还看不出明确结论',
    text: stateCopy[dimension.state],
    boundary: '',
    shareFragment: '',
    selectors: reflectiveSelectors(dimension.id, dimension.state),
    alternativeExplanations: ['不同关系阶段或现实压力可能改变这项表现。'],
    verificationQuestions: ['最近一次出现这类情况时，具体发生了什么？']
  }, answers, options))
}

function observationClaims(evaluation, answers, options) {
  const definitions = {
    REG01: { copyKey: 'OBS_REG01', shareFragment: '' },
    REG02: { copyKey: 'OBS_REG02', shareFragment: '' },
    REG03: { copyKey: 'OBS_REG03', shareFragment: '我会尽量直接说出自己的不安和需要' },
    REG04: { copyKey: 'OBS_REG04', shareFragment: '需要暂停时，我会说明，并回来继续谈' }
  }
  const priority = ['REG03', 'REG04', 'REG01', 'REG02']
  return Object.entries(definitions).filter(([id]) => evaluation.observations[id] === 'active').sort(([left], [right]) => priority.indexOf(left) - priority.indexOf(right)).map(([id, definition]) => claimFromSelectors(Object.assign({}, definition, {
    id: 'OBS_' + id,
    section: 'observation',
    selectors: { supportSelectors: [{ itemIds: [id], raw: 'high' }], contradictionSelectors: [{ itemIds: [id], raw: 'low' }], qualificationSelectors: [] },
    alternativeExplanations: ['这项行为可能依赖具体对象和当时的压力程度。'],
    verificationQuestions: ['最近一次使用或没有使用这项做法时，发生了什么？']
  }), answers, Object.assign({}, options, { qualityStatus: options.qualityStatus })))
}

function provisionClaims(evaluation, answers, options) {
  const definitions = {
    response_predictability: { copyKey: 'PROVIDE_response_predictability', shareFragment: '重要的话题，我通常会说明并回来继续' },
    emotional_support: { copyKey: 'PROVIDE_emotional_support', shareFragment: '对方需要时，我通常先听，再一起处理' },
    autonomy_space: { copyKey: 'PROVIDE_autonomy_space', shareFragment: '我愿意给彼此保留各自的空间' },
    conflict_pause: { copyKey: 'PROVIDE_conflict_pause', shareFragment: '需要暂停时，我会说明，并回来继续谈' },
    repair_reengagement: { copyKey: 'PROVIDE_repair_reengagement', shareFragment: '冷静之后，我愿意回来把问题说清楚' }
  }
  return Object.entries(definitions).filter(([id]) => evaluation.dimensions[id].provideState === 'provide_stable').map(([id, definition]) => claimFromSelectors(Object.assign({}, definition, {
    id: 'PROVIDE_' + id,
    section: 'provide',
    selectors: { supportSelectors: [{ dimension: id, side: 'provide', scored: 'high' }], contradictionSelectors: [{ dimension: id, side: 'provide', scored: 'low' }], qualificationSelectors: [{ dimension: id, side: 'provide', scored: 'mid' }] },
    alternativeExplanations: ['这是通常能做到的行为，不代表在每种压力下都能保持。'],
    verificationQuestions: ['最近一次对方需要这项支持时，你是怎样回应的？']
  }), answers, options))
}

function buildReport(rawAnswers, options = {}) {
  const evaluation = evaluateAssessment(rawAnswers)
  const qualityStatus = options.responseQuality && options.responseQuality.status || 'normal'
  const claimOptions = { generatedAt: options.generatedAt, qualityStatus }
  const combined = rules.filter(rule => rule.conditions.every(condition => matches(evaluation, condition))).map(rule => claimFromSelectors(Object.assign({}, rule, { selectors: rule }), rawAnswers, claimOptions))
  const candidates = combined.concat(provisionClaims(evaluation, rawAnswers, claimOptions)).concat(observationClaims(evaluation, rawAnswers, claimOptions)).concat(fallbackClaims(evaluation, rawAnswers, claimOptions).filter(fallback => !combined.some(item => item.section === fallback.section)))
  const limits = { overall: 1, interaction: 2, resource: 2, provide: 2, tension: 2, observation: 2 }
  const visible = []
  Object.keys(limits).forEach(section => visible.push(...candidates.filter(item => item.section === section).slice(0, limits[section])))
  const visibleClaimIds = visible.map(claim => claim.id)
  const unknownText = publicLanguage.v2.reportFallback.unknownText
  const unknowns = Object.values(evaluation.dimensions).filter(dimension => dimension.state === 'insufficient' || dimension.needState === 'need_insufficient').slice(0, 3).map(dimension => ({ id: dimension.id, title: '还有几件事，现在看不出来', text: unknownText }))
  const shareFragments = visible.filter(claim => claim.shareFragment).slice(0, 2).map(claim => claim.shareFragment)
  return {
    assessmentId: 'relationship_manual_v2',
    instrumentVersion: INSTRUMENT_VERSION,
    scoringRuleVersion: SCORING_RULE_VERSION,
    reportRuleVersion: REPORT_RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    reportCopyVersion: REPORT_COPY_VERSION,
    reportVersion: Number(options.reportVersion) || 1,
    generatedAt: Number(options.generatedAt) || Date.now(),
    title: '你的结果',
    subtitle: '下面这些内容只根据你这次的回答整理。',
    claims: visible,
    allClaimCandidates: candidates,
    visibleClaimIds,
    unknowns,
    feedbackEvents: [],
    userConfirmations: {},
    evaluation,
    responseQuality: options.responseQuality || null,
    shareCard: { title: '我的结果', fragments: shareFragments }
  }
}

module.exports = { buildReport, readPath, matches, selectItemIds, confidenceFor }
