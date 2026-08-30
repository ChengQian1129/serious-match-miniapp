const BUNDLE = require('./assessment-v3-product-v0-questionnaire.generated')
const SCORING = require('./assessment-v3-product-v0-scoring.generated')
const { createDerivedV3Profile, DIMENSION_IDS, CHAPTERS } = require('./assessment-v3-product-contract.generated')

const MISSINGNESS_CODES = Object.freeze(['NOT_APPLICABLE', 'PREFER_NOT_TO_SAY', 'NOT_SURE', 'NOT_ASKED'])
const SOURCE = 'THEORY_DRIVEN_PRODUCT_V0'

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function now() { return Date.now() }

function getTask(taskId) { return BUNDLE.tasks[taskId] || null }
function itemEntries(task) {
  if (task && Array.isArray(task.children) && task.children.length) return task.children.map(child => ({ parent: task, item: child, itemId: child.itemId }))
  return task ? [{ parent: task, item: task, itemId: task.taskId }] : []
}
function allEntries() {
  const result = []
  BUNDLE.orderedParentTaskIds.forEach(parentTaskId => itemEntries(getTask(parentTaskId)).forEach(entry => result.push(entry)))
  return result
}
function getEntry(itemId) {
  return allEntries().find(entry => entry.itemId === itemId) || null
}
function resolveFormat(response) {
  if (!response) return null
  if (response.formatRef) return BUNDLE.responseFormats[response.formatRef] || null
  if (response.inlineFormat) return response.inlineFormat
  return response
}
function formatForEntry(entry) { return resolveFormat(entry && entry.item && entry.item.response) }
function rawCode(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.responseCode !== undefined) return value.responseCode
  return value
}
function isMissingValue(value, missingness) {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (missingness && typeof missingness === 'object' && typeof missingness === 'string') return MISSINGNESS_CODES.includes(missingness)
  return false
}
function isAnswered(itemId, answers, missingness) {
  if (missingness && Object.prototype.hasOwnProperty.call(missingness, itemId)) return false
  return Object.prototype.hasOwnProperty.call(answers || {}, itemId) && !isMissingValue(answers[itemId])
}
function isAccounted(itemId, answers, missingness) {
  return isAnswered(itemId, answers, missingness) || Boolean(missingness && Object.prototype.hasOwnProperty.call(missingness, itemId))
}

function validateValue(entry, value) {
  const format = formatForEntry(entry)
  if (!format) return { ok: false, reason: 'UNKNOWN_RESPONSE_FORMAT' }
  const raw = rawCode(value)
  if (format.type === 'single_select') {
    const valid = (format.options || []).map(option => String(option.code))
    return { ok: valid.includes(String(raw)), reason: valid.includes(String(raw)) ? null : 'INVALID_OPTION' }
  }
  if (format.type === 'multi_select') {
    if (!Array.isArray(raw)) return { ok: false, reason: 'MULTI_SELECT_REQUIRED' }
    const valid = new Set((format.options || []).map(option => String(option.code)))
    const okOptions = raw.every(option => valid.has(String(option)))
    const validation = format.validation || {}
    const okMin = validation.minSelections === undefined || raw.length >= validation.minSelections
    const okMax = validation.maxSelections === undefined || raw.length <= validation.maxSelections
    return { ok: okOptions && okMin && okMax, reason: okOptions && okMin && okMax ? null : 'INVALID_SELECTIONS' }
  }
  if (format.type === 'number') {
    if (raw === '' || raw === null || raw === undefined) return { ok: Boolean(format.allowBlank), reason: format.allowBlank ? null : 'NUMBER_REQUIRED' }
    const number = Number(raw); const validation = format.validation || {}
    const ok = Number.isFinite(number) && (validation.min === undefined || number >= validation.min) && (validation.max === undefined || number <= validation.max)
    return { ok, reason: ok ? null : 'INVALID_NUMBER' }
  }
  if (format.type === 'free_text') {
    const text = String(raw || '')
    const ok = text.length > 0 && text.length <= (format.maxChars || 10000)
    return { ok, reason: ok ? null : 'INVALID_TEXT' }
  }
  return { ok: false, reason: 'UNSUPPORTED_RESPONSE_FORMAT' }
}

function optionLabel(entry, value) {
  const format = resolvePublicFormat(entry && entry.item && entry.item.response, entry && entry.itemId, entry && entry.parent && entry.parent.taskId) || formatForEntry(entry)
  const raw = rawCode(value)
  if (Array.isArray(raw)) {
    return raw.map(code => optionLabel(entry, code)).filter(Boolean).join('、')
  }
  const option = format && (format.options || []).find(candidate => String(candidate.code) === String(raw))
  return option ? option.label : String(raw === undefined || raw === null ? '' : raw)
}

function evidence(entry, value, role, score) {
  return {
    taskId: entry.parent.taskId,
    itemId: entry.itemId === entry.parent.taskId ? null : entry.itemId,
    answerCode: clone(rawCode(value)),
    answerText: optionLabel(entry, value),
    question: entry.item.prompt || entry.parent.prompt || '',
    answer: optionLabel(entry, value),
    role,
    normalized: score === undefined ? null : score
  }
}

function entriesForSelectors(selectors) {
  const list = []
  ;(selectors || []).forEach(selector => {
    const task = getTask(selector)
    if (task) itemEntries(task).forEach(entry => list.push(entry))
    else {
      const entry = getEntry(selector)
      if (entry) list.push(entry)
    }
  })
  const seen = new Set()
  return list.filter(entry => { if (seen.has(entry.itemId)) return false; seen.add(entry.itemId); return true })
}

function numericScore(entry, value, direction) {
  const format = formatForEntry(entry)
  if (!format || !format.ordered) return null
  const raw = Number(rawCode(value))
  const options = (format.options || []).map(option => Number(option.code)).filter(Number.isFinite)
  if (!Number.isFinite(raw) || options.length < 2) return null
  const minimum = Math.min.apply(null, options); const maximum = Math.max.apply(null, options)
  if (maximum === minimum || raw < minimum || raw > maximum) return null
  const normalized = (raw - minimum) / (maximum - minimum)
  return direction === 'REVERSE' ? 1 - normalized : normalized
}

function scalarValues(selectors, answers, missingness, directions) {
  const entries = entriesForSelectors(selectors)
  const values = []
  entries.forEach(entry => {
    if (!isAnswered(entry.itemId, answers, missingness)) return
    const direction = (directions && directions[entry.itemId]) || 'POSITIVE'
    const score = numericScore(entry, answers[entry.itemId], direction)
    if (score === null) return
    values.push({ entry, value: answers[entry.itemId], score })
  })
  return { entries, values, ratio: entries.length ? values.length / entries.length : 0 }
}

function zone(score) {
  if (score < 0.40) return 'LOW'
  if (score > 0.60) return 'HIGH'
  return 'MID'
}
function confidenceFor(values, ratio, minimum, evidenceStatus) {
  if (ratio < minimum || !values.length) return null
  if (evidenceStatus === 'PROVISIONAL') return values.length >= 3 ? 'MEDIUM' : 'LOW'
  return values.length >= 3 ? 'MEDIUM' : 'LOW'
}
function insufficientResult(evidenceStatus, entries) {
  return { resultStatus: 'INSUFFICIENT', confidence: 'LOW', evidenceStatus: evidenceStatus || 'PROVISIONAL', evidence: [], facetResults: {}, rawDerived: { answered: 0, eligible: (entries || []).length } }
}
function estimatedResult(score, data, options) {
  const result = {
    resultStatus: 'ESTIMATED',
    state: options.state || zone(score),
    confidence: options.confidence || confidenceFor(data.values, data.ratio, options.minimum || 0.75, options.evidenceStatus),
    evidenceStatus: options.evidenceStatus || 'PROVISIONAL',
    evidence: [],
    facetResults: options.facetResults || {},
    rawDerived: Object.assign({ score, answered: data.values.length, eligible: data.entries.length, answeredRatio: data.ratio }, options.rawDerived || {})
  }
  const sorted = data.values.slice().sort((a, b) => b.score - a.score)
  sorted.slice(0, 2).forEach(item => result.evidence.push(evidence(item.entry, item.value, 'supporting', item.score)))
  sorted.slice(-1).forEach(item => { if (item.score < 0.40) result.evidence.push(evidence(item.entry, item.value, 'qualifying', item.score)) })
  return result
}
function scoreScalar(selectors, answers, missingness, directions, options = {}) {
  const data = scalarValues(selectors, answers, missingness, directions)
  const minimum = options.minimum || 0.75
  if (data.ratio < minimum) return insufficientResult(options.evidenceStatus, data.entries)
  const score = data.values.reduce((sum, item) => sum + item.score, 0) / data.values.length
  return estimatedResult(score, data, options)
}

function facetScores(facetMap, answers, missingness, directions, minimum, evidenceStatus) {
  const result = {}; const allValues = []; let sufficient = true
  Object.keys(facetMap || {}).forEach(facet => {
    const data = scalarValues(facetMap[facet], answers, missingness, directions)
    const score = data.values.length ? data.values.reduce((sum, item) => sum + item.score, 0) / data.values.length : null
    result[facet] = { score, zone: score === null ? null : zone(score), answered: data.values.length, eligible: data.entries.length, answeredRatio: data.ratio }
    if (data.ratio < minimum || score === null) sufficient = false
    allValues.push.apply(allValues, data.values)
  })
  return { result, allValues, sufficient }
}

function scoreMotivation(answers, missingness) {
  const facets = SCORING.dimensions.initiation_motivation.facets
  const calculated = facetScores(facets, answers, missingness, SCORING.itemDirections, 0.75)
  if (!calculated.sufficient) return insufficientResult('PROVISIONAL', entriesForSelectors(Object.values(facets).reduce((a, b) => a.concat(b), [])))
  const scores = {}; Object.keys(calculated.result).forEach(key => { scores[key] = calculated.result[key].score })
  const autonomous = (scores.intrinsic + scores.identified) / 2
  const controlledPressure = (scores.positiveIntrojected + scores.negativeIntrojected + scores.external) / 3
  let state = 'MIXED'
  if (autonomous > 0.60 && controlledPressure > 0.55) state = 'AUTONOMOUS_PLUS_PRESSURE'
  else if (autonomous > 0.60 && autonomous - controlledPressure >= 0.10 && scores.amotivation < 0.60) state = 'AUTONOMOUS_DOMINANT'
  else if (controlledPressure > 0.60 && controlledPressure - autonomous >= 0.10) state = 'PRESSURE_DOMINANT'
  else if ((autonomous < 0.45 && controlledPressure < 0.45) || scores.amotivation > 0.65) state = 'LOW_MOTIVATION'
  const data = { entries: entriesForSelectors(Object.values(facets).reduce((a, b) => a.concat(b), [])), values: calculated.allValues }
  return estimatedResult(autonomous, data, { state, minimum: 0.75, evidenceStatus: 'PROVISIONAL', facetResults: calculated.result, rawDerived: { facets: scores, autonomous, controlledPressure, amotivation: scores.amotivation } })
}

function scoreCapacity(answers, missingness) {
  const facets = SCORING.dimensions.available_capacity.facets
  const scalarFacets = Object.assign({}, facets, { competingResponsibilities: [] })
  const calculated = facetScores(scalarFacets, answers, missingness, SCORING.itemDirections, 0.75)
  const capacityEntries = entriesForSelectors(Object.values(facets).reduce((a, b) => a.concat(b), []))
  if (isAnswered('CAP10', answers, missingness)) {
    const blocked = Array.isArray(answers.CAP10) && answers.CAP10.some(code => String(code) !== '7')
    calculated.result.competingResponsibilities = { score: blocked ? 0 : 1, zone: blocked ? 'LOW' : 'HIGH', answered: 1, eligible: 1, answeredRatio: 1 }
    calculated.sufficient = Object.keys(scalarFacets).filter(key => key !== 'competingResponsibilities').every(key => calculated.result[key] && calculated.result[key].score !== null && calculated.result[key].answeredRatio >= 0.75)
  } else calculated.sufficient = false
  if (!calculated.sufficient) return insufficientResult('PROVISIONAL', capacityEntries)
  const values = calculated.result
  const core = [values.timeAvailability, values.schedulePredictability, values.emotionalBandwidth]
  const lowCore = core.filter(item => item.zone === 'LOW').length
  const blocker = isAnswered('CAP10', answers, missingness) && Array.isArray(answers.CAP10) && answers.CAP10.some(code => String(code) !== '7')
  const state = lowCore >= 2 || blocker ? 'LOW' : (values.timeAvailability.zone === 'HIGH' && values.emotionalBandwidth.zone === 'HIGH' && values.schedulePredictability.zone !== 'LOW' && !blocker ? 'HIGH' : 'MID')
  return estimatedResult((values.timeAvailability.score + values.emotionalBandwidth.score) / 2, { entries: capacityEntries, values: calculated.allValues }, { state, facetResults: values, rawDerived: { blocker } })
}

function scoreStrategy(answers, missingness) {
  const strategies = SCORING.dimensions.uncertainty_regulation.strategies
  const vector = {}; const allEntries = []; const allValues = []
  Object.keys(strategies).forEach(strategy => {
    const data = scalarValues(strategies[strategy], answers, missingness, SCORING.itemDirections)
    allEntries.push.apply(allEntries, data.entries); allValues.push.apply(allValues, data.values)
    vector[strategy] = data.values.length ? data.values.reduce((sum, item) => sum + item.score, 0) / data.values.length : null
  })
  const answered = allValues.length; const eligible = allEntries.length
  if (!eligible || answered / eligible < 0.50) return insufficientResult('PROVISIONAL', allEntries)
  const ranked = Object.keys(vector).filter(key => vector[key] !== null).sort((a, b) => vector[b] - vector[a])
  const primary = ranked[0]; const second = ranked[1]; const gap = second ? vector[primary] - vector[second] : 1
  const mixed = !primary || gap <= 0.10
  const state = mixed ? 'MIXED' : primary
  const data = { entries: allEntries, values: allValues }
  return estimatedResult(vector[primary] || 0.5, data, { state, minimum: 0.50, facetResults: vector, rawDerived: { vector, primaryStrategy: mixed ? null : primary, secondaryStrategy: !mixed && vector[second] >= 0.50 && gap <= 0.10 ? second : null, gap } })
}

const SUPPORT_FORM_BY_TASK = Object.freeze({ SN01: 'LISTEN_VALIDATE', SN02: 'LISTEN_VALIDATE', SN03: 'PROBLEM_SOLVING', SN04: 'PRESENCE', SN05: 'CLARITY_REASSURANCE', SN06: 'SPACE', SN07: 'CONTEXTUAL_MIXED', SN08: 'CONTEXTUAL_MIXED' })
const SUPPORT_FORM_BY_CODE = Object.freeze({ '1': 'listening', '2': 'validation', '3': 'reassurance', '4': 'problemSolving', '5': 'practicalHelp', '6': 'presence', '7': 'space', '8': 'problemSolving' })
function scoreSupportNeed(answers, missingness) {
  const forms = { listening: 0, validation: 0, reassurance: 0, problemSolving: 0, practicalHelp: 0, presence: 0, space: 0 }
  const entries = entriesForSelectors(SCORING.dimensions.support_need.taskIds); let answered = 0
  entries.forEach(entry => {
    if (!isAnswered(entry.itemId, answers, missingness)) return
    answered += 1
    const parentId = entry.parent.taskId
    const directSupportForm = SUPPORT_FORM_BY_TASK[parentId]
    if (directSupportForm) {
      const supportKey = { LISTEN_VALIDATE: 'listening', PROBLEM_SOLVING: 'problemSolving', PRESENCE: 'presence', CLARITY_REASSURANCE: 'reassurance', SPACE: 'space', CONTEXTUAL_MIXED: 'listening' }[directSupportForm] || 'listening'
      const directScore = numericScore(entry, answers[entry.itemId], SCORING.itemDirections[entry.itemId])
      forms[supportKey] += directScore === null ? 0.05 : 0.05 + directScore
    }
    const raw = rawCode(answers[entry.itemId])
    if (Array.isArray(raw)) raw.forEach(code => { const key = SUPPORT_FORM_BY_CODE[String(code)]; if (key) forms[key] += 1 })
  })
  if (!entries.length || answered / entries.length < 0.50) return insufficientResult('PROVISIONAL', entries)
  const total = Object.values(forms).reduce((sum, value) => sum + value, 0) || 1
  const vector = Object.fromEntries(Object.entries(forms).map(([key, value]) => [key, value / total]))
  const ranked = Object.keys(vector).sort((a, b) => vector[b] - vector[a]); const top = ranked[0]; const second = ranked[1]
  const stateMap = { listening: 'LISTEN_VALIDATE', validation: 'LISTEN_VALIDATE', reassurance: 'CLARITY_REASSURANCE', problemSolving: 'PROBLEM_SOLVING', practicalHelp: 'PRACTICAL_HELP', presence: 'PRESENCE', space: 'SPACE' }
  const state = second && vector[top] - vector[second] <= 0.10 ? 'CONTEXTUAL_MIXED' : stateMap[top]
  const values = entries.filter(entry => isAnswered(entry.itemId, answers, missingness)).map(entry => ({ entry, value: answers[entry.itemId], score: 0.5 }))
  return estimatedResult(vector[top] || 0.5, { entries, values }, { state, minimum: 0.50, facetResults: vector, rawDerived: { vector, topNeed: top, secondNeed: second } })
}

function scorePacing(answers, missingness) {
  const directMappings = SCORING.dimensions.conflict_pacing_need.directMappings
  const entries = entriesForSelectors(Object.keys(directMappings)); const counts = {}; const answeredEntries = []
  entries.forEach(entry => { if (!isAnswered(entry.itemId, answers, missingness)) return; const mapping = directMappings[entry.parent.taskId] || directMappings[entry.itemId]; const state = mapping && mapping[String(rawCode(answers[entry.itemId]))]; if (state) { counts[state] = (counts[state] || 0) + 1; answeredEntries.push({ entry, value: answers[entry.itemId], score: 0.5 }) } })
  if (!answeredEntries.length) return insufficientResult('PROVISIONAL', entries)
  const state = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
  return estimatedResult(0.5, { entries, values: answeredEntries }, { state, confidence: answeredEntries.length > 1 ? 'MEDIUM' : 'LOW', facetResults: counts, rawDerived: { counts } })
}

function scoreDimension(dimensionId, answers, missingness) {
  const definition = SCORING.dimensions[dimensionId]
  if (dimensionId === 'initiation_motivation') return scoreMotivation(answers, missingness)
  if (dimensionId === 'available_capacity') return scoreCapacity(answers, missingness)
  if (dimensionId === 'uncertainty_regulation') return scoreStrategy(answers, missingness)
  if (dimensionId === 'support_need') return scoreSupportNeed(answers, missingness)
  if (dimensionId === 'conflict_pacing_need') return scorePacing(answers, missingness)
  if (definition.facets) {
    const calculated = facetScores(definition.facets, answers, missingness, SCORING.itemDirections, definition.minAnsweredRatio || 0.75, definition.evidenceStatus)
    const entries = entriesForSelectors(Object.values(definition.facets).reduce((a, b) => a.concat(b), []))
    if (!calculated.sufficient) return insufficientResult(definition.evidenceStatus, entries)
    const score = calculated.allValues.reduce((sum, item) => sum + item.score, 0) / calculated.allValues.length
    return estimatedResult(score, { entries, values: calculated.allValues }, { facetResults: calculated.result, evidenceStatus: definition.evidenceStatus, rawDerived: { facets: calculated.result } })
  }
  return scoreScalar(definition.itemIds || [], answers, missingness, SCORING.itemDirections, { minimum: definition.minAnsweredRatio || 0.75, evidenceStatus: definition.evidenceStatus })
}

function decisionValue(code, labels) { return labels[String(code)] || 'UNSURE' }
function deriveDecisionMap(answers, missingness) {
  const l3Items = []; const l4Items = []; const l5Items = []
  const addDirect = (target, itemId, copyKey, valueKey, extra) => { const entry = getEntry(itemId); if (!entry || !isAnswered(itemId, answers, missingness)) return; target.push(Object.assign({ copyKey, valueKey, itemId, rawValue: clone(answers[itemId]) }, extra || {})) }
  addDirect(l3Items, 'L3-CT02', 'contact', 'steady')
  addDirect(l3Items, 'L3-CT03', 'contact', 'explicit')
  addDirect(l3Items, 'L3-ST02', 'time', 'space')
  addDirect(l3Items, 'L3-CF02', 'conflict', 'return')
  addDirect(l3Items, 'L3-CF03', 'conflict', 'early')
  addDirect(l4Items, 'CF-S02', 'ideal', 'natural', { field: 'ideal' })
  addDirect(l4Items, 'L4-TR01', 'tradeoff', 'weigh', { field: 'tradeOff' })
  addDirect(l4Items, 'L4-TR02', 'tradeoff', 'slow', { field: 'tradeOff' })
  addDirect(l4Items, 'L4-PH01.a', 'priority', 'explicit', { field: 'priority' })
  addDirect(l4Items, 'L5-CH07', 'boundary', 'self_defined', { field: 'hardness', hard: Number(rawCode(answers['L5-CH07'])) >= 4 })
  addDirect(l5Items, 'L5-CH01', 'desire', Number(rawCode(answers['L5-CH01'])) >= 4 ? 'clear' : 'open', { field: 'DESIRE' })
  addDirect(l5Items, 'L5-CH02', 'intention', Number(rawCode(answers['L5-CH02'])) >= 4 ? 'some' : 'observe', { field: 'INTENTION' })
  addDirect(l5Items, 'L5-GEO03', 'feasibility', 'separate', { field: 'FEASIBILITY' })
  addDirect(l5Items, 'L5-MR03', 'constraint', 'confirm', { field: 'CONSTRAINT', hard: Number(rawCode(answers['L5-MR03'])) >= 4 })
  const facts = SCORING.l3.taskIds ? [] : []
  return { l3: { items: l3Items, facts }, l4: { items: l4Items }, l5: { items: l5Items } }
}

function deriveUnknowns(dimensionResults) {
  const unknowns = []
  Object.keys(dimensionResults).forEach(id => { if (dimensionResults[id].resultStatus === 'INSUFFICIENT') unknowns.push('realInteraction') })
  return Array.from(new Set(unknowns.concat(['partnerResponse', 'lifeChange'])))
}

function latestAnswersFromEvents(events) {
  const answers = {}; (events || []).forEach(event => { if (event && event.itemId) answers[event.itemId] = clone(event.rawValue) })
  return answers
}

function createEmptySession(startedAt = now()) {
  return {
    assessmentId: `v3-product-v0.${startedAt}`,
    assessmentType: 'v3-product-v0',
    instrumentVersion: BUNDLE.instrument.version,
    productQuestionnaireVersion: BUNDLE.instrument.questionnaireVersion,
    scoringModelVersion: 'v3-product-scoring-v0.1.0',
    latestAnswers: {},
    answers: {},
    answerEvents: [],
    missingness: {},
    taskEvents: [],
    currentTaskIndex: 0,
    completedChapters: [],
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    status: 'draft_local',
    derivedProfileVersion: null,
    reportVersion: null
  }
}

function answerItem(sessionInput, itemId, rawValue, timestamp = now()) {
  const session = clone(sessionInput || createEmptySession(timestamp))
  const entry = getEntry(itemId)
  if (!entry) throw new Error(`Unknown Product v0 item: ${itemId}`)
  const validation = validateValue(entry, rawValue)
  if (!validation.ok) throw new Error(`Invalid Product v0 answer ${itemId}: ${validation.reason}`)
  const previous = session.answerEvents.filter(event => event.itemId === itemId).slice(-1)[0] || null
  const event = { eventId: `${itemId}.${timestamp}.${session.answerEvents.length + 1}`, itemId, taskId: entry.parent.taskId, rawValue: clone(rawValue), answeredAt: timestamp, supersedesEventId: previous ? previous.eventId : null, immutable: true }
  session.answerEvents = (session.answerEvents || []).concat(event)
  session.latestAnswers = Object.assign({}, session.latestAnswers || session.answers || {}, { [itemId]: clone(rawValue) })
  session.answers = session.latestAnswers
  if (session.missingness) delete session.missingness[itemId]
  session.updatedAt = timestamp
  return session
}
function markMissing(sessionInput, itemId, code, timestamp = now()) {
  if (!MISSINGNESS_CODES.includes(code)) throw new Error(`Invalid missingness code: ${code}`)
  const session = clone(sessionInput || createEmptySession(timestamp)); if (!getEntry(itemId)) throw new Error(`Unknown Product v0 item: ${itemId}`)
  if (session.latestAnswers) delete session.latestAnswers[itemId]
  if (session.answers) delete session.answers[itemId]
  session.missingness = Object.assign({}, session.missingness, { [itemId]: { code, markedAt: timestamp } }); session.updatedAt = timestamp
  return session
}
function progress(sessionInput) {
  const session = sessionInput || createEmptySession(); const answers = session.latestAnswers || session.answers || {}; const missingness = session.missingness || {}
  const completedParents = BUNDLE.orderedParentTaskIds.filter(parentId => itemEntries(getTask(parentId)).every(entry => isAccounted(entry.itemId, answers, missingness))).length
  return { completedParents, assignedParents: BUNDLE.orderedParentTaskIds.length, ratio: BUNDLE.orderedParentTaskIds.length ? completedParents / BUNDLE.orderedParentTaskIds.length : 0 }
}

function deriveProfile(sessionOrAnswers, options = {}) {
  const session = sessionOrAnswers && sessionOrAnswers.latestAnswers ? sessionOrAnswers : null
  const answers = session ? (session.latestAnswers || session.answers || {}) : (sessionOrAnswers || {})
  const missingness = session ? session.missingness || {} : options.missingness || {}
  const dimensionResults = {}
  DIMENSION_IDS.forEach(id => { dimensionResults[id] = scoreDimension(id, answers, missingness) })
  const decisionMap = deriveDecisionMap(answers, missingness)
  const motivation = dimensionResults.initiation_motivation
  const context = {
    supportNeedKnown: dimensionResults.support_need.resultStatus === 'ESTIMATED',
    majorConstraintConflict: decisionMap.l4.items.some(item => item.hard === true),
    pressure: motivation.rawDerived && zone(motivation.rawDerived.controlledPressure || 0.5),
    autonomous: motivation.rawDerived && zone(motivation.rawDerived.autonomous || 0.5)
  }
  const chapterStates = {
    C1: dimensionResults.relationship_readiness.state || 'INSUFFICIENT',
    C2: `${dimensionResults.available_capacity.state || 'INSUFFICIENT'}_${dimensionResults.relational_follow_through.state || 'INSUFFICIENT'}`,
    C3: null,
    C4: `${dimensionResults.intimacy_dependence_comfort.state || 'INSUFFICIENT'}_${dimensionResults.personal_space_need.state || 'INSUFFICIENT'}`,
    C5: `${dimensionResults.support_need.state || 'INSUFFICIENT'}_${dimensionResults.support_signaling.state || 'INSUFFICIENT'}_${dimensionResults.responsiveness_capability.state || 'INSUFFICIENT'}`,
    C6: `${dimensionResults.conflict_activation.state || 'INSUFFICIENT'}_${dimensionResults.conflict_pacing_need.state || 'INSUFFICIENT'}_${dimensionResults.repair_reengagement.state || 'INSUFFICIENT'}`
  }
  const profile = {
    contractVersion: 'v3.derived-profile.v1.0',
    source: SOURCE,
    isSynthetic: false,
    persona: { id: '', labelKey: '', descriptionKey: '' },
    assessmentMeta: {
      assessmentId: session ? session.assessmentId : (options.assessmentId || 'v3-product-v0.local'),
      assessedAt: options.assessedAt || (session && (session.completedAt || session.updatedAt)) || now(),
      instrumentVersion: BUNDLE.instrument.version,
      productQuestionnaireVersion: BUNDLE.instrument.questionnaireVersion,
      scoringModelVersion: 'v3-product-scoring-v0.1.0',
      constructRegistryVersion: 'relationship-feature-model-v3.master-construct-registry.v0.1',
      itemFreezeVersion: 'relationship-feature-model-v3.report-core-questionnaire.v1.0',
      authoringLibraryVersion: 'relationship-feature-model-v3.user-report-authoring-library.v1.0',
      reportVersion: 'v3.product-report.v1.0',
      researchStatus: 'THEORY_DRIVEN_PROVISIONAL'
    },
    dimensionResults,
    chapterStates,
    patternContext: context,
    expectedPatternIds: [],
    unknowns: deriveUnknowns(dimensionResults),
    interviewPriorities: [{ copyKey: 'realInteraction', dimensionId: 'responsiveness_capability' }, { copyKey: 'supportPattern', dimensionId: 'support_need' }, { copyKey: 'repairInPractice', dimensionId: 'repair_reengagement' }],
    decisionMap,
    rawAnswerSummary: { answered: Object.keys(answers).length, missing: Object.keys(missingness).length, answerEventCount: session ? session.answerEvents.length : 0 }
  }
  return createDerivedV3Profile(profile)
}

function completeSession(sessionInput, timestamp = now()) {
  const session = clone(sessionInput || createEmptySession(timestamp)); const p = progress(session)
  if (p.completedParents < p.assignedParents) throw new Error(`Product v0 still has ${p.assignedParents - p.completedParents} unanswered tasks`)
  session.status = 'completed'; session.completedAt = timestamp; session.updatedAt = timestamp
  const profile = deriveProfile(session, { assessedAt: timestamp })
  session.derivedProfileVersion = 'v3.derived-profile.v1.0'; session.reportVersion = 'v3.product-report.v1.0'; session.derivedProfile = profile
  return session
}

function publicTask(taskId) {
  const task = getTask(taskId); if (!task) return null
  const publicCopy = BUNDLE.publicCopy || {}
  const publicTask = Object.assign({}, task, {
    prompt: publicPrompt((publicCopy.taskPrompts || {})[task.taskId] || task.prompt || ''),
    section: task.freezeMeta && task.freezeMeta.chapter && (publicCopy.chapterTitles || {})[task.freezeMeta.chapter] || ''
  })
  if (Array.isArray(task.children)) {
    publicTask.children = task.children.map(child => Object.assign({}, child, {
      prompt: publicPrompt((publicCopy.childPrompts || {})[child.itemId] || child.prompt || '')
    }))
  }
  return publicTask
}

function publicOptionLabels(responseSpec, itemId, parentTaskId) {
  const format = resolveFormat(responseSpec)
  if (!format) return {}
  const publicCopy = BUNDLE.publicCopy || {}
  return Object.assign({},
    (publicCopy.responseFormatOptions || {})[responseSpec && responseSpec.formatRef] || {},
    (publicCopy.taskOptions || {})[itemId] || {},
    (publicCopy.taskSpecificOptions || {})[parentTaskId] || {}
  )
}

function resolvePublicFormat(responseSpec, itemId, parentTaskId) {
  const format = resolveFormat(responseSpec)
  if (!format) return null
  const labels = publicOptionLabels(responseSpec, itemId, parentTaskId)
  if (!Object.keys(labels).length) return format
  return Object.assign({}, format, { options: (format.options || []).map(option => Object.assign({}, option, labels[String(option.code)] ? { label: labels[String(option.code)] } : {})) })
}

function publicPrompt(value) { return String(value || '').replace(/\*\*/g, '') }

module.exports = {
  BUNDLE,
  SCORING,
  SOURCE,
  MISSINGNESS_CODES,
  clone,
  getTask,
  getEntry,
  itemEntries,
  resolveFormat,
  validateValue,
  optionLabel,
  isAnswered,
  isAccounted,
  progress,
  createEmptySession,
  answerItem,
  markMissing,
  deriveProfile,
  completeSession,
  latestAnswersFromEvents,
  publicTask,
  getPublicTask: publicTask,
  resolvePublicFormat,
  scoreDimension,
  zone
}
