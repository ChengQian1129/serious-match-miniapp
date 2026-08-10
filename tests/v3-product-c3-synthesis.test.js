const assert = require('node:assert/strict')
const { getFixture } = require('../shared/assessment-v3-product/fixtures')
const { createDerivedV3Profile, clone } = require('../shared/assessment-v3-product/contract')
const { buildReport } = require('../shared/assessment-v3-product/report-renderer')

function profileWith(activation, regulation, secondaryStrategy = null) {
  const profile = clone(getFixture('ready_self'))
  profile.dimensionResults.uncertainty_activation.state = activation
  profile.dimensionResults.uncertainty_regulation.state = regulation
  profile.dimensionResults.uncertainty_regulation.secondaryState = secondaryStrategy
  return createDerivedV3Profile(profile)
}

function c3View(profile) {
  return buildReport(profile).chapterSyntheses.find(chapter => chapter.id === 'C3')
}

const highClarifying = c3View(profileWith('HIGH', 'CLARIFYING'))
const lowClarifying = c3View(profileWith('LOW', 'CLARIFYING'))
const highRuminative = c3View(profileWith('HIGH', 'RUMINATIVE'))
const highWaiting = c3View(profileWith('HIGH', 'TOLERANT_WAITING'))
const lowWithdrawing = c3View(profileWith('LOW', 'WITHDRAWING'))
const midMixed = c3View(profileWith('MID', 'MIXED'))
const highClarifyingRuminative = c3View(profileWith('HIGH', 'CLARIFYING', 'RUMINATIVE'))

assert.notEqual(highClarifying.headline, lowClarifying.headline)
assert.notEqual(highClarifying.headline, highRuminative.headline)
assert.notEqual(highClarifying.headline, highWaiting.headline)
assert.notEqual(lowWithdrawing.headline, lowClarifying.headline)
assert.notEqual(midMixed.headline, highClarifying.headline)
assert.notEqual(highClarifying.headline, highClarifyingRuminative.headline)
assert.match(highClarifyingRuminative.headline, /反复想/)

const regulationCard = buildReport(profileWith('HIGH', 'CLARIFYING')).dimensionCards.find(card => card.id === 'uncertainty_regulation')
assert.notEqual(highClarifying.headline, regulationCard.headline)

const internalStateCodes = [
  'VERY_LOW', 'LOW', 'MID', 'HIGH', 'VERY_HIGH', 'CLARIFYING', 'OBSERVING',
  'REASSURANCE_ORIENTED', 'MONITORING_ORIENTED', 'RUMINATIVE', 'TESTING_PROTEST',
  'TOLERANT_WAITING', 'WITHDRAWING', 'MIXED'
]
;[highClarifying, lowClarifying, highRuminative, highWaiting, lowWithdrawing, midMixed, highClarifyingRuminative].forEach(view => {
  internalStateCodes.forEach(code => {
    assert.equal(view.headline.includes(code), false)
    assert.equal(view.summary.includes(code), false)
  })
})

console.log('V3 C3 synthesis OK: activation, primary strategy, and secondary strategy are composed')
