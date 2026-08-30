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
store.resetSession()

let partial = runtime.answerItem(store.emptySession(100), 'RR01', 1, 101)
store.saveSession(partial)

let loaded = loadPage('../pages/v3-checkpoint/index.js')
loaded.page.onLoad({ mode: 'product-v0', section: 'C1', nextIndex: 10 })
assert.equal(loaded.page.data.isProductMode, true)
assert.equal(loaded.page.data.hasNext, true)
assert.match(loaded.page.data.chapterNumberText, /第 1 \/ 10 部分/)
assert.equal(loaded.page.data.progressWidth, '0%')
loaded.page.openResult()
assert.match(lastNavigation.url, /scope=partial/)

loaded = loadPage('../pages/v3-result/index.js')
loaded.page.onLoad({ mode: 'product-v0', scope: 'partial' })
assert.equal(loaded.page.data.ready, true)
assert.equal(loaded.page.data.isPartial, true)
assert.equal(loaded.page.data.journeySections.length, 10)
assert.equal(loaded.page.data.hasPatterns, false)
loaded.page.openAnswerReview()
assert.match(lastNavigation.url, /v3-answer-review/)
assert.match(lastNavigation.url, /returnTo=/)

loaded = loadPage('../pages/v3-answer-review/index.js')
loaded.page.onLoad({ mode: 'product-v0', returnTo: encodeURIComponent('/pages/v3-result/index?mode=product-v0&scope=partial') })
assert.equal(loaded.page.data.ready, true)
assert.equal(loaded.page.data.sections.length, 10)
assert.equal(loaded.page.data.sections[0].status, 'in_progress')
loaded.page.editItem({ currentTarget: { dataset: { taskId: 'RR01' } } })
assert.match(lastNavigation.url, /taskId=RR01/)
assert.match(lastNavigation.url, /returnTo=/)

loaded = loadPage('../pages/questionnaire-v3/index.js')
loaded.page.onLoad({ taskId: 'L5-GEO01' })
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

loaded = loadPage('../pages/v3-result/index.js')
loaded.page.onLoad({ mode: 'product-v0' })
assert.equal(loaded.page.data.isComplete, true)
assert.equal(loaded.page.data.isPartial, false)
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

loaded = loadPage('../pages/questionnaire-v3/index.js')
loaded.page.onLoad({ taskId: 'RR01', returnTo: encodeURIComponent('/pages/v3-result/index?mode=product-v0') })
loaded.page.handleContinue()
assert.match(lastNavigation.url, /v3-result\/index\?mode=product-v0/)
assert.equal(store.getSession().reportRevision, 2)

console.log('Product v0 pages OK: partial checkpoint/result, answer review editing, and local report recompute')
