const constants = require('./constants')

function labelOf(options, value) {
  const match = options.find(item => item.value === value)
  return match ? match.label : ''
}

function buildProfileView(profile) {
  const basic = profile.basic || {}
  const relationship = profile.relationship || {}
  const about = profile.about || {}
  const industry = labelOf(constants.INDUSTRIES, about.industry)
  const workStatus = about.workStatus === 'skip' ? '' : labelOf(constants.WORK_STATUSES, about.workStatus)
  const childPlan = labelOf(constants.CHILD_PLANS, relationship.childPlan)
  const lines = []

  const personal = []
  if (about.heightCm) personal.push(`${about.heightCm} cm`)
  if (workStatus) personal.push(workStatus)
  if (industry) personal.push(industry)
  if (about.occupation) personal.push(about.occupation.trim())
  if (personal.length) lines.push(personal.join(' · '))
  if (relationship.goal) lines.push(labelOf(constants.GOALS, relationship.goal))
  if (relationship.settlementPlan) {
    lines.push(labelOf(constants.SETTLEMENT_PLANS, relationship.settlementPlan))
  }
  if (childPlan && relationship.childPlan !== 'skip') lines.push(`关于孩子：${childPlan}`)

  const targetGender = labelOf(constants.TARGET_GENDERS, basic.targetGender)
  const min = relationship.targetAgeMin
  const max = relationship.targetAgeMax
  const ageRange = min && max ? `${min}—${max} 岁` : ''
  let target = ageRange || targetGender
  if (basic.targetGender === 'male' || basic.targetGender === 'female') {
    target = ageRange ? `${ageRange}的${targetGender}` : targetGender
  } else if (basic.targetGender === 'all') {
    target = ageRange ? `${ageRange}，性别不限` : '性别不限'
  } else if (basic.targetGender === 'undisclosed') {
    target = ageRange ? `${ageRange}，性别期待暂不说明` : '性别期待暂不说明'
  }

  const birthYear = basic.birthDate ? basic.birthDate.slice(0, 4) : basic.birthYear
  const meta = [birthYear ? `${birthYear} 年` : '', labelOf(constants.GENDERS, basic.gender)]
    .filter(Boolean)
    .join(' · ')
  const district = labelOf(constants.DISTRICTS, basic.district)

  return {
    meta,
    district: district && !district.startsWith('大连') ? `大连${district}` : district,
    lines,
    target
  }
}

function maskPhone(phone) {
  if (!phone || phone.length !== 11) return phone || ''
  return `${phone.slice(0, 3)}****${phone.slice(7)}`
}

module.exports = { labelOf, buildProfileView, maskPhone }
