const { ITEMS, getItem } = require('./questionnaire-definitions')
const { scored, missing } = require('./scoring-engine')

function longestSameRun(answers, itemOrder) {
  let longest = 0
  let current = 0
  let previous
  ;(itemOrder || ITEMS.map(item => item.id)).forEach(itemId => {
    const value = answers[itemId]
    if (typeof value !== 'number') { current = 0; previous = undefined; return }
    current = value === previous ? current + 1 : 1
    previous = value
    longest = Math.max(longest, current)
  })
  return longest
}

function inconsistentDimensionCount(answers) {
  const groups = {}
  ITEMS.filter(item => item.role === 'reflective').forEach(item => {
    const value = answers[item.id]
    if (missing(value)) return
    groups[item.constructId] = (groups[item.constructId] || []).concat(scored(getItem(item.id), value))
  })
  return Object.values(groups).filter(values => values.includes(1) && values.includes(5)).length
}

function assessResponseQuality(session) {
  const answers = session && session.answers || {}
  const events = Array.isArray(session && session.answerEvents) ? session.answerEvents : []
  const firstEvents = events.filter((event, index, list) => list.findIndex(item => item.itemId === event.itemId) === index).sort((a, b) => Number(a.answeredAt) - Number(b.answeredAt))
  let rapidResponseCount = 0
  firstEvents.forEach((event, index) => { if (index && Number(event.answeredAt) - Number(firstEvents[index - 1].answeredAt) < 700) rapidResponseCount += 1 })
  const missingCount = ITEMS.filter(item => missing(answers[item.id])).length
  const longestRun = longestSameRun(answers, session && session.itemOrder)
  const inconsistentPairs = inconsistentDimensionCount(answers)
  const revisionCount = Math.max(0, events.length - new Set(events.map(event => event.itemId)).size)
  const durationMs = session && session.completedAt ? Math.max(0, Number(session.completedAt) - Number(session.startedAt || session.completedAt)) : null
  const flags = []
  if (longestRun > 12) flags.push('long_string_pattern')
  if (missingCount / ITEMS.length > 0.25) flags.push('high_missingness')
  if (inconsistentPairs >= 2) flags.push('inconsistent_pairs')
  if (rapidResponseCount >= 10) flags.push('rapid_response_pattern')
  const status = flags.includes('high_missingness') ? 'limited_evidence' : flags.length ? 'review_recommended' : 'normal'
  return { status, durationMs, rapidResponseCount, longestSameResponseRun: longestRun, missingCount, missingRatio: missingCount / ITEMS.length, revisionCount, inconsistentDimensionCount: inconsistentPairs, flags }
}

module.exports = { assessResponseQuality, longestSameRun, inconsistentDimensionCount }
