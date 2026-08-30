const assert = require('node:assert/strict')
const runtime = require('../shared/assessment-v3-product-v0/runtime-engine')

function firstAnswers() {
  const answers = {}
  runtime.BUNDLE.responseFieldIds.forEach(itemId => {
    const entry = runtime.getEntry(itemId); const format = runtime.resolveFormat(entry.item.response)
    if (!format) return
    if (format.type === 'single_select') answers[itemId] = format.options[0].code
    else if (format.type === 'multi_select') answers[itemId] = format.options.slice(0, format.validation && format.validation.minSelections || 1).map(option => option.code)
    else if (format.type === 'number') answers[itemId] = format.validation && format.validation.min !== undefined ? format.validation.min : 30
    else if (format.type === 'free_text') answers[itemId] = '暂时不填写'
  })
  return answers
}
function withOverrides(overrides) { return Object.assign(firstAnswers(), overrides) }
function setCodes(prefixes, code, answers) { runtime.BUNDLE.responseFieldIds.filter(id => prefixes.some(prefix => id.startsWith(prefix))).forEach(id => { const entry = runtime.getEntry(id); const format = runtime.resolveFormat(entry.item.response); if (format && format.type === 'single_select') answers[id] = code }) }

const base = firstAnswers()
const profile = runtime.deriveProfile(base)
assert.equal(profile.source, 'THEORY_DRIVEN_PRODUCT_V0')
assert.equal(profile.isSynthetic, false)
assert.equal(Object.keys(profile.dimensionResults).length, 14)
assert.equal(profile.assessmentMeta.researchStatus, 'THEORY_DRIVEN_PROVISIONAL')
assert.ok(profile.dimensionResults.relationship_readiness.evidence.length)
assert.equal(runtime.optionLabel(runtime.getEntry('SE-P01'), 1), '很少主动和朋友见面')
assert.equal(runtime.optionLabel(runtime.getEntry('EX-P02'), 1), '几乎从不主动提新地方或新活动')

const unknown = runtime.deriveProfile(Object.fromEntries(Object.entries(base).slice(0, 4)))
assert.equal(unknown.dimensionResults.relationship_readiness.resultStatus, 'INSUFFICIENT')
assert.equal(unknown.dimensionResults.relationship_readiness.state, undefined)
assert.deepEqual(unknown.chapterStates.C3, { activation: null, primaryStrategy: null, secondaryStrategy: null })

const highReadyLowCapacity = withOverrides({ CAP10: ['1'], CAP01: '1', CAP04: '1', CAP06: '1', CAP13: '1', CAP14: '1' })
setCodes(['RR'], 7, highReadyLowCapacity); ['RR04', 'RR07', 'RR10'].forEach(id => { highReadyLowCapacity[id] = 1 })
const profile1 = runtime.deriveProfile(highReadyLowCapacity)
assert.equal(profile1.dimensionResults.relationship_readiness.state, 'HIGH')
assert.equal(profile1.dimensionResults.available_capacity.state, 'LOW')

const autonomousPressure = withOverrides({ 'IM-IN01': 7, 'IM-IN02': 7, 'IM-ID01': 7, 'IM-ID02': 7, 'IM-PI01': 7, 'IM-PI02': 7, 'IM-NI01': 7, 'IM-NI02': 7, 'IM-EX01': 7, 'IM-EX02': 7 })
const profile2 = runtime.deriveProfile(autonomousPressure)
assert.equal(profile2.dimensionResults.initiation_motivation.state, 'AUTONOMOUS_PLUS_PRESSURE')

const clarifying = withOverrides({ 'UR-DC01': 5, 'UR-DC02': 5, 'UR-DC03': 5 })
const profile3 = runtime.deriveProfile(clarifying)
assert.equal(profile3.dimensionResults.uncertainty_regulation.state, 'CLARIFYING')
assert.equal(profile3.chapterStates.C3.primaryStrategy, 'CLARIFYING')

const ruminative = withOverrides({ 'UR-RU01': 5, 'UR-RU02': 5, 'UR-MO01': 5, 'UR-MO02': 5 })
const profile4 = runtime.deriveProfile(ruminative)
assert.ok(['RUMINATIVE', 'MONITORING_ORIENTED', 'MIXED'].includes(profile4.dimensionResults.uncertainty_regulation.state))

const closeSpace = withOverrides({ PS01: 5, PS02: 5, PS03: 5, PS04: 5, PS05: 7, PS06: 7, PS07: 7 })
const profile5 = runtime.deriveProfile(closeSpace)
assert.equal(profile5.dimensionResults.personal_space_need.state, 'HIGH')

const supportSpecific = withOverrides({ SN03: 7, SN07: 7, SN08: 7, 'SN-S01.a': ['4'], 'SN-S02.a': ['4'], 'SN-S03.a': ['4'], 'SN-S04.a': ['4'] })
const profile6 = runtime.deriveProfile(supportSpecific)
assert.ok(['PROBLEM_SOLVING', 'CONTEXTUAL_MIXED'].includes(profile6.dimensionResults.support_need.state))

const highConflictRepair = withOverrides({ CP01: 2, CR01: 5, CR02: 5, CR04: 5, CR05: 5, CR06: 5, CR08: 5, CR09: 5 })
const profile7 = runtime.deriveProfile(highConflictRepair)
assert.ok(['SHORT_PAUSE', 'LONGER_PAUSE'].includes(profile7.dimensionResults.conflict_pacing_need.state))
assert.equal(profile7.dimensionResults.repair_reengagement.evidenceStatus, 'PROVISIONAL')

const changed = runtime.answerItem(runtime.createEmptySession(1), 'RR01', 7, 2)
const changedAgain = runtime.answerItem(changed, 'RR01', 6, 3)
assert.equal(changedAgain.answerEvents.length, 2)
assert.equal(changedAgain.answerEvents[1].supersedesEventId, changedAgain.answerEvents[0].eventId)
assert.equal(changedAgain.answerEvents[0].rawValue, 7)

const sameA = runtime.deriveProfile(base)
const sameB = runtime.deriveProfile(base)
assert.deepEqual(sameA.dimensionResults, sameB.dimensionResults)

console.log('assessment-v3-product-v0 runtime tests OK: raw answers, insufficiency, strategy vector, capability boundary, and immutable events')

module.exports = { firstAnswers }
