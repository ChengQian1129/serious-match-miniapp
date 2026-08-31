const assert = require('node:assert/strict')
const fs = require('node:fs')

const storage = new Map()
let lastNavigation = null
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  showToast() {},
  navigateTo(options) { lastNavigation = options },
  redirectTo(options) { lastNavigation = options },
  navigateBack(options) { if (options && options.fail) options.fail({ errMsg: 'no page stack' }) },
  reLaunch(options) { lastNavigation = options },
  pageScrollTo() {}
}

let definition
global.Page = value => { definition = value }

function loadPage(relativePath) {
  const file = require.resolve(relativePath)
  delete require.cache[file]
  definition = null
  const helpers = require(relativePath)
  const page = definition
  page.setData = function setData(update) {
    const next = Object.assign({}, this.data)
    Object.entries(update || {}).forEach(([key, value]) => { next[key] = value })
    this.data = next
  }
  return { page, helpers }
}

const runtime = require('../shared/assessment-v3-product-v0/runtime-engine')
const store = require('../utils/assessment-v3-product-v0/session-store')
const journey = require('../utils/assessment-v3-product-v0/journey-model')
const { encodeReturnContext } = require('../utils/assessment-v3-product-v0/return-context')
store.resetSession()

function valueFor(entry) {
  const format = runtime.resolveFormat(entry.item.response)
  if (format.type === 'single_select') return format.options[0].code
  if (format.type === 'multi_select') return format.options.slice(0, Number(format.validation && format.validation.minSelections) || 1).map(option => option.code)
  if (format.type === 'number') return String(format.validation && format.validation.min !== undefined ? format.validation.min : 1)
  return 'partial page test'
}

let partial = runtime.createEmptySession(100)
let partialTimestamp = 101
journey.getSections()[0].taskIds.forEach(taskId => runtime.itemEntries(runtime.getTask(taskId)).forEach(entry => {
  partial = runtime.answerItem(partial, entry.itemId, valueFor(entry), partialTimestamp)
  partialTimestamp += 1
}))
const partialInitialEventCount = partial.answerEvents.length
const partialResumeIndex = journey.getTaskIndexById(journey.getSections()[1].taskIds[0])
partial.currentTaskIndex = partialResumeIndex
store.saveSession(partial)

let loaded = loadPage('../pages/v3-checkpoint/index.js')
loaded.page.onLoad({ mode: 'product-v0', section: 'C1', nextIndex: 10 })
assert.equal(loaded.page.data.isProductMode, true)
assert.equal(loaded.page.data.hasNext, true)
assert.match(loaded.page.data.chapterNumberText, /第 1 \/ 10 部分/)
assert.equal(loaded.page.data.progressWidth, '10%')
loaded.page.openResult()
assert.match(lastNavigation.url, /scope=partial/)

loaded = loadPage('../pages/v3-result/index.js')
loaded.page.onLoad({ mode: 'product-v0', scope: 'partial' })
assert.equal(loaded.page.data.ready, true)
assert.equal(loaded.page.data.isPartial, true)
assert.equal(loaded.page.data.journeySections.length, 10)
assert.equal(loaded.page.data.journeySections[0].isComplete, true)
assert.equal(loaded.page.data.hasPatterns, false)
loaded.page.openContinue()
assert.equal(lastNavigation.url, `/pages/questionnaire-v3/index?index=${partialResumeIndex}`)
loaded.page._isRouting = false
loaded.page.openAnswerReview()
assert.match(lastNavigation.url, /v3-answer-review/)
assert.match(lastNavigation.url, /returnContext=/)

loaded = loadPage('../pages/v3-answer-review/index.js')
loaded.page.onLoad({ mode: 'product-v0', returnContext: encodeReturnContext({ source: 'partial-result', targetId: '', scrollAnchor: '', reportVersion: 0 }) })
assert.equal(loaded.page.data.ready, true)
assert.equal(loaded.page.data.sections.length, 10)
assert.equal(loaded.page.data.sections[0].status, 'complete')
assert.equal(loaded.page.data.sections[0].expanded, true)
const reviewRR01 = loaded.page.data.sections[0].items.find(item => item.taskId === 'RR01')
const reviewFuture = loaded.page.data.sections.find(section => section.id === 'PART_B_L5_LIFE_DESIGN').items.find(item => item.taskId === 'L5-GEO01')
assert.equal(reviewRR01.editable, true)
assert.equal(reviewFuture.editable, false)
lastNavigation = null
loaded.page.editItem({ currentTarget: { dataset: { taskId: 'RR01' } } })
assert.match(lastNavigation.url, /taskId=RR01/)
assert.match(lastNavigation.url, /mode=edit/)
assert.match(lastNavigation.url, /returnContext=/)

// Partial result -> answered task edit must finish the edit even though the
// assessment as a whole is still incomplete.
loaded = loadPage('../pages/questionnaire-v3/index.js')
loaded.page.onLoad({ taskId: 'RR01', mode: 'edit', returnContext: encodeReturnContext({ source: 'partial-result', targetId: '', scrollAnchor: '', reportVersion: 0 }) })
assert.equal(loaded.page.data.editing, true)
loaded.page.chooseAnswer({ currentTarget: { dataset: { itemId: 'RR01', value: 2 } } })
loaded.page.handleContinue()
assert.equal(store.getSession().completedAt, null)
assert.equal(store.getSession().answerEvents.length, partialInitialEventCount + 1)
assert.equal(store.getSession().answerEvents[0].rawValue, 1)
assert.equal(store.getSession().answerEvents.find(event => event.itemId === 'RR01' && event.rawValue === 2).rawValue, 2)
assert.match(lastNavigation.url, /v3-result\/index\?mode=product-v0&scope=partial/)
loaded = loadPage('../pages/v3-result/index.js')
loaded.page.onLoad({ mode: 'product-v0', scope: 'partial' })
assert.equal(loaded.page.data.isPartial, true)
assert.equal(loaded.page.data.report.chapterSyntheses.some(chapter => chapter.id === 'C1'), true)
assert.equal(loaded.page.data.report.executiveSummary.patterns.length, 0)

// Both the review row and a hand-built edit URL reject an unanswered future task.
lastNavigation = null
loaded = loadPage('../pages/v3-answer-review/index.js')
loaded.page.onLoad({ mode: 'product-v0', returnContext: encodeReturnContext({ source: 'partial-result' }) })
loaded.page.editItem({ currentTarget: { dataset: { taskId: 'L5-GEO01' } } })
assert.equal(lastNavigation, null)
loaded = loadPage('../pages/questionnaire-v3/index.js')
loaded.page.onLoad({ taskId: 'L5-GEO01', mode: 'edit', returnContext: encodeReturnContext({ source: 'answer-review', targetId: 'PART_B_L5_LIFE_DESIGN' }) })
assert.equal(loaded.page.data.invalidRoute, true)
assert.match(lastNavigation.url, /v3-answer-review/)

loaded = loadPage('../pages/questionnaire-v3/index.js')
store.setTaskId('L5-GEO01')
loaded.page.onLoad({ index: store.getTaskIndexById('L5-GEO01') })
loaded.page.handleInput({ currentTarget: { dataset: { itemId: 'L5-GEO01' } }, detail: { value: '' } })
loaded.page.handleContinue()
assert.equal(store.getSession().missingness['L5-GEO01'].code, 'NOT_SURE')
assert.equal(loaded.page.data.validationMessage, '')

let full = runtime.createEmptySession(200)
let timestamp = 300
runtime.BUNDLE.orderedParentTaskIds.forEach(taskId => runtime.itemEntries(runtime.getTask(taskId)).forEach(entry => {
  const format = runtime.resolveFormat(entry.item.response)
  const value = format.type === 'single_select' ? format.options[0].code : format.type === 'multi_select' ? format.options.slice(0, Number(format.validation && format.validation.minSelections) || 1).map(option => option.code) : format.type === 'number' ? String(format.validation && format.validation.min !== undefined ? format.validation.min : 1) : 'full page test'
  full = runtime.answerItem(full, entry.itemId, value, timestamp)
  timestamp += 1
}))
full = runtime.completeSession(full, timestamp)
full.reportRevision = 1
store.saveSession(full)
store.saveReport({ source: 'THEORY_DRIVEN_PRODUCT_V0', reportVersion: 0, executiveSummary: { patterns: [] } })

loaded = loadPage('../pages/v3-result/index.js')
loaded.page.onLoad({ mode: 'product-v0' })
assert.equal(loaded.page.data.isComplete, true)
assert.equal(loaded.page.data.isPartial, false)
assert.equal(loaded.page.data.report.reportVersion, 1)
assert.equal(loaded.page.data.journeySections.every(section => section.isComplete), true)
assert.match(fs.readFileSync(require.resolve('../pages/v3-result/index.wxml'), 'utf8'), /data-target-type="pattern"/)
assert.match(fs.readFileSync(require.resolve('../pages/v3-result/index.wxml'), 'utf8'), /data-target-type="chapter"/)
assert.match(fs.readFileSync(require.resolve('../pages/v3-result/index.wxml'), 'utf8'), /data-target-type="dimension"/)
const pattern = loaded.page.data.report.executiveSummary.patterns[0]
if (pattern) {
  loaded.page.selectTargetFeedback({ currentTarget: { dataset: { targetType: 'pattern', targetId: pattern.id, value: 'does_not_fit' } } })
  assert.equal(loaded.page.data.report.executiveSummary.patterns[0].feedbackValue, 'does_not_fit')
  loaded.page.submitTargetFeedback({ currentTarget: { dataset: { targetType: 'pattern', targetId: pattern.id } } })
  assert.equal(loaded.page.data.report.executiveSummary.patterns[0].feedbackSubmitted, true)
}
loaded.page.selectTargetFeedback({ currentTarget: { dataset: { targetType: 'chapter', targetId: 'C1', value: 'fits' } } })
assert.equal(loaded.page.data.chapters[0].feedbackValue, 'fits')
loaded.page.selectTargetFeedback({ currentTarget: { dataset: { targetType: 'dimension', targetId: 'relationship_readiness', value: 'fits' } } })
assert.equal(loaded.page.data.chapters[0].dimensionCards[0].feedbackValue, 'fits')

// Result -> evidence -> exact source task -> edit -> evidence keeps the
// evidence context and advances the report revision.
const evidenceCard = loaded.page.data.report.dimensionCards.find(card => card.evidenceAvailable)
assert.ok(evidenceCard)
loaded = loadPage('../pages/v3-result-evidence/index.js')
loaded.page.onLoad({ mode: 'product-v0', dimension: evidenceCard.id, returnContext: encodeReturnContext({ source: 'evidence', targetId: evidenceCard.id, reportVersion: 1 }) })
assert.equal(loaded.page.data.ready, true)
const sourceEvidence = loaded.page.data.finding.evidence[0]
assert.ok(sourceEvidence.taskId)
lastNavigation = null
loaded.page.editEvidence({ currentTarget: { dataset: { taskId: sourceEvidence.taskId, itemId: sourceEvidence.itemId || '' } } })
assert.match(lastNavigation.url, new RegExp(`taskId=${sourceEvidence.taskId}`))
assert.match(lastNavigation.url, /mode=edit/)

loaded = loadPage('../pages/questionnaire-v3/index.js')
loaded.page.onLoad({ taskId: sourceEvidence.taskId, mode: 'edit', returnContext: encodeReturnContext({ source: 'evidence', targetId: evidenceCard.id, scrollAnchor: sourceEvidence.itemId || '', reportVersion: 1 }) })
const evidenceEntry = runtime.getEntry(sourceEvidence.itemId || sourceEvidence.taskId)
const evidenceFormat = runtime.resolveFormat(evidenceEntry.item.response)
const evidenceValue = evidenceFormat.options.find(option => String(option.code) !== String(store.getSession().latestAnswers[evidenceEntry.itemId])) || evidenceFormat.options[evidenceFormat.options.length - 1]
loaded.page.chooseAnswer({ currentTarget: { dataset: { itemId: evidenceEntry.itemId, value: evidenceValue.code } } })
loaded.page.handleContinue()
assert.equal(store.getSession().status, 'completed')
assert.equal(store.getSession().reportRevision, 2)
assert.match(lastNavigation.url, /v3-result-evidence/)
assert.match(lastNavigation.url, new RegExp(`dimension=${evidenceCard.id}`))

loaded = loadPage('../pages/questionnaire-v3/index.js')
loaded.page.onLoad({ taskId: 'RR01', mode: 'edit', returnContext: encodeReturnContext({ source: 'result', reportVersion: 2 }) })
loaded.page.chooseAnswer({ currentTarget: { dataset: { itemId: 'RR01', value: 7 } } })
loaded.page.handleContinue()
assert.match(lastNavigation.url, /v3-result\/index\?mode=product-v0/)
assert.equal(store.getSession().reportRevision, 3)

console.log('Product v0 pages OK: partial edit, locked future guard, evidence context, and versioned local recompute')
