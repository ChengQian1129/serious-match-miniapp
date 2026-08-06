const { ITEMS, DIMENSIONS, INSTRUMENT_VERSION, optionsFor } = require('./questionnaire-definitions')
const { evaluateAssessment, SCORING_RULE_VERSION } = require('./scoring-engine')
const { rules, REPORT_RULE_VERSION } = require('./report-rules')

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

function sourceIdsFor(rule, evaluation) {
  const ids = []
  rule.conditions.forEach(([path]) => {
    if (path.startsWith('observations.')) ids.push(path.split('.')[1])
    else {
      const dimension = evaluation.dimensions[path.split('.')[0]]
      if (dimension) ids.push(...(dimension.supportingItemIds || dimension.sourceItemIds || []))
    }
  })
  return [...new Set(ids)]
}

function fallbackClaims(evaluation) {
  const stateCopy = {
    strong_present: '多道回答一致支持这个方向。', lean_present: '当前回答较多指向这个方向。',
    strong_less: '多道回答一致呈现相反方向。', lean_less: '当前回答较多不支持这个方向。',
    mixed: '不同情境下的回答并不完全一致。'
  }
  return Object.values(evaluation.dimensions).filter(dimension => dimension.kind === 'reflective' && stateCopy[dimension.state]).map(dimension => ({
    id: `DIM_${dimension.id}`, section: dimension.id === 'readiness_intent' || dimension.id === 'available_capacity' ? 'overall' : 'interaction',
    title: dimension.title, text: stateCopy[dimension.state], boundary: '这是当前自述形成的方向，不是固定人格。', shareFragment: '',
    confidenceState: dimension.state === 'mixed' ? 'context_dependent' : 'multi_item_supported',
    supportingItemIds: dimension.supportingItemIds, contradictingItemIds: dimension.contradictingItemIds
  }))
}

function evidenceFor(ids, answers) {
  return ids.map(id => {
    const item = ITEMS.find(current => current.id === id)
    const option = item && optionsFor(item).find(current => current.value === answers[id])
    return item ? { itemId: id, question: item.text, rawValue: answers[id], answer: option ? option.label : '暂未判断' } : null
  }).filter(Boolean)
}

function observationClaims(evaluation) {
  const definitions = {
    REG01: { title: '不确定时，你可能会增加确认', text: '关系状态不清楚时，你可能通过连续确认、反复发消息或追问来尽快获得信息。', boundary: '这只是常见应对动作，具体是否合适取决于当时的关系和沟通方式。', shareFragment: '' },
    REG02: { title: '压力变大时，你可能先把话题放下', text: '关系有压力时，你可能减少回应、搁置话题或暂时消失，让自己先退出当下情境。', boundary: '暂时退开不等于拒绝关系，但是否说明和回来会改变对方的理解。', shareFragment: '' },
    REG03: { title: '你有机会直接说出不安', text: '你能够尝试用明确的话表达自己的不安和需要，而不只依靠猜测或试探。', boundary: '有这项资源不代表每次在强烈情绪下都能立即使用。', shareFragment: '我会尽量直接说出自己的不安和需要' },
    REG04: { title: '你可能会说明暂停并再回来', text: '需要暂停时，你通常愿意说明原因，并给出大概什么时候继续谈的线索。', boundary: '真实冲突中的修复仍需要结合具体事件观察。', shareFragment: '需要暂停时，我会说明，并回来继续谈' }
  }
  const priority = ['REG03', 'REG04', 'REG01', 'REG02']
  return Object.entries(definitions).filter(([id]) => evaluation.observations[id] === 'active').sort(([left], [right]) => priority.indexOf(left) - priority.indexOf(right)).map(([id, definition]) => ({
    id: `OBS_${id}`, section: 'observation', title: definition.title, text: definition.text, boundary: definition.boundary,
    shareFragment: definition.shareFragment, confidenceState: 'behavior_observation', supportingItemIds: [id], contradictingItemIds: []
  }))
}

function provisionClaims(evaluation) {
  const definitions = {
    response_predictability: { title: '你通常会让重要回应有下文', text: '暂时不能回应时，你通常能够说明情况，并在之后回到原来的话题。', boundary: '忙碌或强烈情绪可能影响这种稳定性。', shareFragment: '重要的话题，我通常会说明并回来继续' },
    emotional_support: { title: '你通常能先理解，再一起处理', text: '对方情绪不好时，你通常能够先听完，并确认对方需要陪伴还是建议。', boundary: '真实感受仍需要由相处中的对方核对。', shareFragment: '对方需要时，我通常先听，再一起处理' },
    autonomy_space: { title: '你通常愿意给彼此保留空间', text: '你通常能够尊重对方的独处、朋友、兴趣和个人安排。', boundary: '关系不安或冲突时，空间是否仍能被尊重需要继续观察。', shareFragment: '我愿意给彼此保留各自的空间' },
    conflict_pause: { title: '你通常能把暂停说清楚', text: '争执升温时，你通常能够提出暂停、说明原因，并留下继续讨论的时间线索。', boundary: '暂停只有在之后真正回来时才构成关系资源。', shareFragment: '需要暂停时，我会说明，并回来继续谈' },
    repair_reengagement: { title: '你通常愿意重新开启修复', text: '冷静后，你通常愿意回到问题，理解对方感受，并承认自己造成的具体影响。', boundary: '严重边界问题不能只依靠一般修复流程处理。', shareFragment: '冷静之后，我愿意回来把问题说清楚' }
  }
  return Object.entries(definitions).filter(([id]) => evaluation.dimensions[id].provideState === 'provide_stable').map(([id, definition]) => ({
    id: `PROVIDE_${id}`, section: 'provide', title: definition.title, text: definition.text, boundary: definition.boundary,
    shareFragment: definition.shareFragment, confidenceState: 'multi_item_supported', supportingItemIds: ITEMS.filter(item => item.constructId === id && item.side === 'provide').map(item => item.id), contradictingItemIds: []
  }))
}

function buildReport(rawAnswers, options = {}) {
  const evaluation = evaluateAssessment(rawAnswers)
  const combined = rules.filter(rule => rule.conditions.every(condition => matches(evaluation, condition))).map(rule => ({
    id: rule.id, section: rule.section, title: rule.title, text: rule.text, boundary: rule.boundary,
    shareFragment: rule.shareFragment, confidenceState: 'multi_item_supported',
    supportingItemIds: sourceIdsFor(rule, evaluation), contradictingItemIds: []
  }))
  const selected = combined.concat(provisionClaims(evaluation)).concat(observationClaims(evaluation)).concat(fallbackClaims(evaluation).filter(fallback => !combined.some(item => item.section === fallback.section)))
  const limits = { overall: 1, interaction: 2, resource: 2, provide: 2, tension: 2, observation: 2 }
  const claims = []
  Object.keys(limits).forEach(section => claims.push(...selected.filter(item => item.section === section).slice(0, limits[section])))
  claims.forEach(claim => { claim.evidence = evidenceFor(claim.supportingItemIds, rawAnswers) })
  const unknowns = Object.values(evaluation.dimensions).filter(dimension => dimension.state === 'insufficient' || dimension.needState === 'need_insufficient').slice(0, 3).map(dimension => ({ id: dimension.id, title: dimension.title, text: '目前还没有足够回答支持判断。' }))
  const shareFragments = claims.filter(claim => claim.shareFragment).slice(0, 2).map(claim => claim.shareFragment)
  return {
    assessmentId: 'relationship_manual_v2', instrumentVersion: INSTRUMENT_VERSION,
    scoringRuleVersion: SCORING_RULE_VERSION, reportRuleVersion: REPORT_RULE_VERSION,
    reportVersion: Number(options.reportVersion) || 1, generatedAt: Number(options.generatedAt) || Date.now(),
    title: shareFragments.length ? shareFragments.join(' · ') : '你的关系说明书正在形成',
    subtitle: '这是根据你当前自述形成的关系快照，不是固定人格或心理诊断。',
    claims, unknowns, evaluation, responseQuality: options.responseQuality || null,
    shareCard: { title: '我的关系说明书', fragments: shareFragments }
  }
}

module.exports = { buildReport, readPath, matches }
