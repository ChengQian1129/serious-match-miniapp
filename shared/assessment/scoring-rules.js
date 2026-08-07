const { INSTRUMENT_VERSION, ITEMS, DIMENSIONS, getItem, optionsFor } = require('./schema')

const SCORING_RULE_VERSION = 'serious-match-scoring-2.1.0'
const missing = value => value === undefined || value === null || value === '' || value === 'NA' || value === 'SKIP'
const scored = (item, raw) => missing(raw) ? null : item.reverseScored ? 6 - Number(raw) : Number(raw)

function validateAnswers(source) {
  const answers = source && typeof source === 'object' && !Array.isArray(source) ? source : {}
  Object.entries(answers).forEach(([itemId, value]) => {
    const item = getItem(itemId)
    if (!item || !optionsFor(item).some(option => option.value === value)) throw new Error(`回答 ${itemId} 无效`)
  })
  return answers
}

function reflectiveState(values, minimum) {
  if (values.length < minimum) return 'insufficient'
  const high = values.filter(value => value >= 4).length
  const low = values.filter(value => value <= 2).length
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (high === values.length && mean >= 4.25) return 'strong_present'
  if (low === values.length && mean <= 1.75) return 'strong_less'
  if (high && low) return 'mixed'
  if ((high / values.length >= .75 && !low) || (mean >= 3.4 && !low)) return 'lean_present'
  if ((low / values.length >= .75 && !high) || (mean <= 2.6 && !high)) return 'lean_less'
  return 'mixed'
}

function needState(values) {
  if (values.length < 2) return 'need_insufficient'
  if (values.every(value => value >= 4)) return 'need_clear'
  if (values.every(value => value <= 2)) return 'need_lower'
  if (values.some(value => value >= 4) && values.some(value => value <= 2)) return 'need_mixed'
  return 'need_flexible'
}

function provideState(values) {
  if (values.length < 2) return 'provide_uncertain'
  if (values.some(value => value <= 2)) return 'provide_constrained'
  if (values.every(value => value >= 4)) return 'provide_stable'
  return 'provide_variable'
}

function evidence(items, answers) {
  return items.map(item => ({ itemId: item.id, rawValue: answers[item.id], scoredValue: scored(item, answers[item.id]) }))
    .filter(entry => entry.scoredValue !== null)
}

function evaluateAssessment(rawAnswers) {
  const answers = validateAnswers(rawAnswers)
  const dimensions = {}
  Object.entries(DIMENSIONS).forEach(([id, definition]) => {
    const dimensionItems = ITEMS.filter(item => item.constructId === id)
    if (definition.kind === 'reflective') {
      const entries = evidence(dimensionItems, answers)
      dimensions[id] = {
        id, title: definition.title, kind: definition.kind,
        state: reflectiveState(entries.map(entry => entry.scoredValue), definition.minimum),
        validCount: entries.length,
        supportingItemIds: entries.filter(entry => entry.scoredValue >= 4).map(entry => entry.itemId),
        contradictingItemIds: entries.filter(entry => entry.scoredValue <= 2).map(entry => entry.itemId)
      }
      return
    }
    const needEntries = evidence(dimensionItems.filter(item => item.side === 'need'), answers)
    const provideEntries = evidence(dimensionItems.filter(item => item.side === 'provide'), answers)
    dimensions[id] = {
      id, title: definition.title, kind: definition.kind,
      needState: needState(needEntries.map(entry => entry.scoredValue)),
      provideState: provideState(provideEntries.map(entry => entry.scoredValue)),
      sourceItemIds: needEntries.concat(provideEntries).map(entry => entry.itemId)
    }
  })
  const observations = {}
  ITEMS.filter(item => item.role === 'observation').forEach(item => {
    const value = answers[item.id]
    observations[item.id] = missing(value) ? 'insufficient' : value >= 4 ? 'active' : value <= 2 ? 'not_endorsed' : 'unclear'
  })
  return { assessmentId: 'relationship_manual_v2', instrumentVersion: INSTRUMENT_VERSION, scoringRuleVersion: SCORING_RULE_VERSION, dimensions, observations }
}

module.exports = { SCORING_RULE_VERSION, evaluateAssessment, validateAnswers, scored, missing }
