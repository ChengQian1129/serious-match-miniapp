const MATCHING_RULE_VERSION = 'serious-match-matching-1.0.0'

const NEED_DIMENSIONS = ['response_predictability', 'emotional_support', 'autonomy_space', 'conflict_pause', 'repair_reengagement']
const DIMENSION_LABELS = {
  response_predictability: '回应是否有说明和下文',
  emotional_support: '情绪支持的方式',
  autonomy_space: '彼此保留个人空间',
  conflict_pause: '冲突时怎样暂停',
  repair_reengagement: '冷静后怎样重新靠近'
}

function ageOf(profile, now = new Date()) {
  const birthDate = profile && profile.basic && profile.basic.birthDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || '')) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  let age = now.getFullYear() - year
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1
  return age
}

function acceptsGender(preference, gender) { return preference === 'all' || preference === gender }
function ageRangeStatus(age, relationship) {
  const min = Number(relationship && relationship.targetAgeMin)
  const max = Number(relationship && relationship.targetAgeMax)
  if (!Number.isFinite(age) || !Number.isFinite(min) || !Number.isFinite(max) || !min || !max) return 'missing'
  return age >= min && age <= max ? 'pass' : 'blocked'
}
function activeProfile(profile) { return Boolean(profile && profile.status === 'active' && profile.matching && profile.matching.matchingPoolConsentAt) }
function reportEvaluation(report) { return report && report.evaluation && report.evaluation.dimensions ? report.evaluation : null }
function availabilityStatus(left, right) {
  const values = [left && left.relationship && left.relationship.availability, right && right.relationship && right.relationship.availability]
  if (values.some(value => !value || value === 'undisclosed')) return 'missing'
  return values.every(value => value === 'single_ready') ? 'pass' : 'blocked'
}
function smokingDirection(acceptance, status) {
  if (!acceptance || !status || status === 'undisclosed') return 'missing'
  if (acceptance === 'any' || acceptance === 'open' || status === 'never') return 'aligned'
  if (acceptance === 'occasionally' && ['occasionally', 'quitting'].includes(status)) return 'aligned'
  return 'confirm'
}

function hardConditions(left, right) {
  const leftAge = ageOf(left)
  const rightAge = ageOf(right)
  const leftBasic = left && left.basic || {}
  const rightBasic = right && right.basic || {}
  const leftRelationship = left && left.relationship || {}
  const rightRelationship = right && right.relationship || {}
  return [
    { id: 'left_profile_active', label: 'A 已进入匹配池', status: activeProfile(left) ? 'pass' : 'missing' },
    { id: 'right_profile_active', label: 'B 已进入匹配池', status: activeProfile(right) ? 'pass' : 'missing' },
    { id: 'left_gender_preference', label: 'A 的性别期待', status: leftBasic.gender && rightBasic.gender ? (acceptsGender(leftBasic.targetGender, rightBasic.gender) ? 'pass' : 'blocked') : 'missing' },
    { id: 'right_gender_preference', label: 'B 的性别期待', status: leftBasic.gender && rightBasic.gender ? (acceptsGender(rightBasic.targetGender, leftBasic.gender) ? 'pass' : 'blocked') : 'missing' },
    { id: 'left_age_preference', label: 'A 的年龄范围', status: ageRangeStatus(rightAge, leftRelationship) },
    { id: 'right_age_preference', label: 'B 的年龄范围', status: ageRangeStatus(leftAge, rightRelationship) },
    { id: 'relationship_availability', label: '双方单身且当前可进入关系', status: availabilityStatus(left, right) }
  ]
}

function realityChecks(left, right) {
  const a = left && left.relationship || {}
  const b = right && right.relationship || {}
  const rows = []
  if (a.goal && b.goal) rows.push({ id: 'relationship_goal', label: '关系目标', status: a.goal === b.goal ? 'aligned' : 'confirm' })
  else rows.push({ id: 'relationship_goal', label: '关系目标', status: 'missing' })
  if (a.settlementPlan && b.settlementPlan) rows.push({ id: 'settlement_plan', label: '长期生活计划', status: a.settlementPlan === b.settlementPlan ? 'aligned' : 'confirm' })
  else rows.push({ id: 'settlement_plan', label: '长期生活计划', status: 'missing' })
  if (a.childPlan && b.childPlan) rows.push({ id: 'child_plan', label: '孩子计划', status: a.childPlan === b.childPlan ? 'aligned' : 'confirm' })
  else rows.push({ id: 'child_plan', label: '孩子计划', status: 'missing' })
  if (a.maritalHistory && b.maritalHistory && a.childrenStatus && b.childrenStatus) rows.push({ id: 'family_history', label: '婚姻史与子女情况', status: 'confirm' })
  else rows.push({ id: 'family_history', label: '婚姻史与子女情况', status: 'missing' })
  if (a.distanceAcceptance && b.distanceAcceptance) rows.push({ id: 'distance_acceptance', label: '异地接受度', status: a.distanceAcceptance === b.distanceAcceptance ? 'aligned' : 'confirm' })
  else rows.push({ id: 'distance_acceptance', label: '异地接受度', status: 'missing' })
  const leftSmoking = smokingDirection(a.smokingAcceptance, b.smokingStatus)
  const rightSmoking = smokingDirection(b.smokingAcceptance, a.smokingStatus)
  rows.push({ id: 'smoking_boundary', label: '吸烟边界', status: leftSmoking === 'missing' || rightSmoking === 'missing' ? 'missing' : leftSmoking === 'aligned' && rightSmoking === 'aligned' ? 'aligned' : 'confirm' })
  return rows
}

function compareDirection(needEvaluation, provideEvaluation, dimensionId, needParty, provideParty) {
  const need = needEvaluation.needState
  const provide = provideEvaluation.provideState
  const dimension = DIMENSION_LABELS[dimensionId]
  const direction = `${needParty} 的需要 ← ${provideParty} 的提供`
  if (need === 'need_clear' && provide === 'provide_stable') return { dimension: dimensionId, direction, status: 'support', text: `${direction}：${dimension}有明确支持线索。` }
  if (need === 'need_clear' && provide === 'provide_variable') return { dimension: dimensionId, direction, status: 'confirm', text: `${direction}：${dimension}值得在认识前说清。` }
  if (need === 'need_clear' && provide === 'provide_constrained') return { dimension: dimensionId, direction, status: 'caution', text: `${direction}：${dimension}存在需要提前确认的差异。` }
  if (need === 'need_lower' && provide === 'provide_stable') return { dimension: dimensionId, direction, status: 'confirm', text: `${direction}：${dimension}未必冲突，但投入方式值得确认。` }
  if (need === 'need_mixed') return { dimension: dimensionId, direction, status: 'unknown', text: `${direction}：${dimension}会随情境变化，先了解具体情境。` }
  if (need === 'need_insufficient' || provide === 'provide_uncertain') return { dimension: dimensionId, direction, status: 'unknown', text: `${direction}：${dimension}目前资料不足。` }
  return null
}

function interactionRules(leftEvaluation, rightEvaluation) {
  const left = leftEvaluation.dimensions
  const right = rightEvaluation.dimensions
  const leftHighUncertainty = ['strong_present', 'lean_present'].includes(left.uncertainty_sensitivity && left.uncertainty_sensitivity.state)
  const rightHighUncertainty = ['strong_present', 'lean_present'].includes(right.uncertainty_sensitivity && right.uncertainty_sensitivity.state)
  const rules = []
  if (leftHighUncertainty && right.response_predictability && right.response_predictability.provideState === 'provide_constrained') rules.push({ id: 'uncertainty_response_a', text: 'B 的联系变化可能更容易被 A 体验为关系态度变化，需要提前说明忙碌和暂时退开的方式。' })
  if (rightHighUncertainty && left.response_predictability && left.response_predictability.provideState === 'provide_constrained') rules.push({ id: 'uncertainty_response_b', text: 'A 的联系变化可能更容易被 B 体验为关系态度变化，需要提前说明忙碌和暂时退开的方式。' })
  if (leftHighUncertainty && right.autonomy_space && right.autonomy_space.needState === 'need_clear') rules.push({ id: 'uncertainty_space_a', text: 'B 需要个人空间时，A 可能更需要解释和确认，双方应区分空间与拒绝。' })
  if (rightHighUncertainty && left.autonomy_space && left.autonomy_space.needState === 'need_clear') rules.push({ id: 'uncertainty_space_b', text: 'A 需要个人空间时，B 可能更需要解释和确认，双方应区分空间与拒绝。' })
  if (leftEvaluation.observations.REG01 === 'active' && rightEvaluation.observations.REG02 === 'active') rules.push({ id: 'pursue_withdraw_ab', text: '压力下可能出现 A 增加确认、B 减少回应的循环；这不是自动排除条件，但适合提前约定暂停和回来规则。' })
  if (rightEvaluation.observations.REG01 === 'active' && leftEvaluation.observations.REG02 === 'active') rules.push({ id: 'pursue_withdraw_ba', text: '压力下可能出现 B 增加确认、A 减少回应的循环；这不是自动排除条件，但适合提前约定暂停和回来规则。' })
  if (left.repair_reengagement && right.repair_reengagement && left.repair_reengagement.provideState === 'provide_stable' && right.repair_reengagement.provideState === 'provide_stable') rules.push({ id: 'shared_repair_resource', text: '双方都报告自己会在冷静后重新回到问题并承认影响，这是积极线索，仍需真实互动验证。' })
  return rules
}

function buildCandidateComparison(leftProfile, leftReport, rightProfile, rightReport) {
  const hard = hardConditions(leftProfile, rightProfile)
  const leftEvaluation = reportEvaluation(leftReport)
  const rightEvaluation = reportEvaluation(rightReport)
  const missing = []
  if (!leftEvaluation) missing.push('A 的关系说明书')
  if (!rightEvaluation) missing.push('B 的关系说明书')
  missing.push(...hard.filter(item => item.status === 'missing').map(item => item.label))
  const result = { matchingRuleVersion: MATCHING_RULE_VERSION, hardConditions: hard, reality: realityChecks(leftProfile, rightProfile), supports: [], confirmations: [], cautions: [], unknowns: missing, interaction: [] }
  if (!leftEvaluation || !rightEvaluation) return result
  NEED_DIMENSIONS.forEach(id => {
    ;[[leftEvaluation.dimensions[id], rightEvaluation.dimensions[id], 'A', 'B'], [rightEvaluation.dimensions[id], leftEvaluation.dimensions[id], 'B', 'A']].forEach(([need, provide, needParty, provideParty]) => {
      if (!need || !provide) return
      const row = compareDirection(need, provide, id, needParty, provideParty)
      if (!row) return
      if (row.status === 'support') result.supports.push(row)
      else if (row.status === 'caution') result.cautions.push(row)
      else if (row.status === 'confirm') result.confirmations.push(row)
      else result.unknowns.push(row.text)
    })
  })
  result.interaction = interactionRules(leftEvaluation, rightEvaluation)
  result.supports = result.supports.slice(0, 3)
  result.confirmations = result.confirmations.slice(0, 3)
  result.cautions = result.cautions.slice(0, 3)
  result.unknowns = result.unknowns.slice(0, 5)
  return result
}

module.exports = { MATCHING_RULE_VERSION, buildCandidateComparison, ageOf }
