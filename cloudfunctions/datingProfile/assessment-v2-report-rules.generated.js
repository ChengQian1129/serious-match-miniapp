const REPORT_RULE_VERSION = 'serious-match-report-rules-2.1.0'

function selectorFor(condition, inverse) {
  const [path, , expected] = condition
  if (path.startsWith('observations.')) return { itemIds: [path.split('.')[1]], raw: inverse ? 'low' : 'high' }
  const [dimension, field] = path.split('.')
  const values = Array.isArray(expected) ? expected : [expected]
  let scored = 'high'
  let side
  if (field === 'state') {
    const includesLow = values.some(value => ['lean_less', 'strong_less'].includes(value))
    if (includesLow) scored = 'low'
    if (values.includes('mixed') && !includesLow) scored = values.length > 1 ? 'non_high' : 'polarized'
  }
  if (field === 'needState') {
    side = 'need'
    if (values.includes('need_lower')) scored = 'low'
    if (values.some(value => ['need_flexible', 'need_mixed'].includes(value))) scored = 'non_high'
  }
  if (field === 'provideState') {
    side = 'provide'
    if (values.includes('provide_constrained')) scored = 'low'
    if (values.includes('provide_variable')) scored = 'non_high'
  }
  if (inverse) scored = scored === 'high' ? 'low' : scored === 'low' ? 'high' : 'high'
  return Object.assign({ dimension, scored }, side ? { side } : {})
}

function selectorsFor(conditions) {
  return {
    supportSelectors: conditions.map(condition => selectorFor(condition, false)),
    contradictionSelectors: conditions.map(condition => selectorFor(condition, true)),
    qualificationSelectors: conditions.filter(condition => !condition[0].startsWith('observations.')).map(condition => Object.assign({}, selectorFor(condition, false), { scored: 'mid' }))
  }
}

const rules = [
  ['COMB_STATUS_01', 'overall', [['readiness_intent.state', 'in', ['strong_present', 'lean_present']], ['available_capacity.state', 'in', ['lean_less', 'strong_less']]]],
  ['COMB_STATUS_02', 'overall', [['readiness_intent.state', 'in', ['lean_less', 'strong_less']], ['available_capacity.state', 'in', ['lean_present', 'strong_present']]]],
  ['COMB_MOTIVATION_01', 'overall', [['readiness_intent.state', 'in', ['strong_present', 'lean_present']], ['autonomous_motivation.state', 'in', ['lean_less', 'strong_less', 'mixed']]]],
  ['COMB_UNCERTAINTY_01', 'interaction', [['uncertainty_sensitivity.state', 'in', ['strong_present', 'lean_present']], ['observations.REG03', 'eq', 'active']]],
  ['COMB_UNCERTAINTY_02', 'tension', [['uncertainty_sensitivity.state', 'in', ['strong_present', 'lean_present']], ['observations.REG01', 'eq', 'active']]],
  ['COMB_UNCERTAINTY_03', 'tension', [['uncertainty_sensitivity.state', 'in', ['strong_present', 'lean_present']], ['observations.REG02', 'eq', 'active']]],
  ['COMB_DISTANCE_01', 'interaction', [['uncertainty_sensitivity.state', 'in', ['strong_present', 'lean_present']], ['closeness_discomfort.state', 'in', ['strong_present', 'lean_present']]]],
  ['COMB_CLOSENESS_01', 'interaction', [['closeness_discomfort.state', 'in', ['lean_less', 'strong_less']], ['autonomy_space.needState', 'eq', 'need_clear']]],
  ['COMB_RESPONSE_01', 'resource', [['response_predictability.needState', 'eq', 'need_clear'], ['response_predictability.provideState', 'eq', 'provide_stable']]],
  ['COMB_RESPONSE_02', 'tension', [['response_predictability.needState', 'eq', 'need_clear'], ['response_predictability.provideState', 'in', ['provide_variable', 'provide_constrained']]]],
  ['COMB_SUPPORT_01', 'resource', [['emotional_support.needState', 'eq', 'need_clear'], ['emotional_support.provideState', 'eq', 'provide_stable']]],
  ['COMB_SUPPORT_02', 'tension', [['emotional_support.needState', 'eq', 'need_clear'], ['emotional_support.provideState', 'in', ['provide_variable', 'provide_constrained']]]],
  ['COMB_SPACE_01', 'resource', [['autonomy_space.needState', 'eq', 'need_clear'], ['autonomy_space.provideState', 'eq', 'provide_stable']]],
  ['COMB_SPACE_02', 'tension', [['autonomy_space.needState', 'eq', 'need_clear'], ['autonomy_space.provideState', 'in', ['provide_variable', 'provide_constrained']]]],
  ['COMB_CONFLICT_01', 'resource', [['conflict_pause.needState', 'eq', 'need_clear'], ['conflict_pause.provideState', 'eq', 'provide_stable'], ['repair_reengagement.provideState', 'eq', 'provide_stable']]],
  ['COMB_CONFLICT_02', 'tension', [['repair_reengagement.needState', 'eq', 'need_clear'], ['repair_reengagement.provideState', 'in', ['provide_variable', 'provide_constrained']]]],
  ['COMB_REGULATION_01', 'tension', [['observations.REG01', 'eq', 'active'], ['observations.REG02', 'eq', 'active']]],
  ['COMB_RESOURCE_01', 'resource', [['observations.REG03', 'eq', 'active'], ['observations.REG04', 'eq', 'active'], ['repair_reengagement.provideState', 'eq', 'provide_stable']]],
  ['COMB_CAPACITY_01', 'tension', [['available_capacity.state', 'in', ['lean_less', 'strong_less']], ['response_predictability.provideState', 'in', ['provide_variable', 'provide_constrained']]]]
].map(([id, section, conditions]) => Object.assign({ id, section, copyKey: id, conditions, applicableContexts: [] }, selectorsFor(conditions)))

module.exports = { REPORT_RULE_VERSION, rules }
