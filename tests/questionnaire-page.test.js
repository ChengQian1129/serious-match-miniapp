const assert = require('node:assert/strict')

const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  getWindowInfo() { return { statusBarHeight: 20 } },
  pageScrollTo() {},
  nextTick(callback) { callback() },
  navigateTo() {},
  redirectTo(options) { redirectedTo = options.url; if (options.success) options.success({}) },
  navigateBack() {},
  reLaunch() {}
}

let definition
let redirectedTo = ''
global.Page = value => { definition = value }
require('../pages/questionnaire/index.js')

const page = Object.assign({}, definition, {
  data: JSON.parse(JSON.stringify(definition.data)),
  setData(values, callback) { Object.assign(this.data, values); if (callback) callback() }
})

page.onLoad({ chapter: 'C1', question: '0' })
assert.equal(page.data.currentQuestion, 0)
const firstValue = page.data.responseOptions[0].value
page.chooseAnswer({ currentTarget: { dataset: { value: firstValue } } })
assert.equal(page.data.canContinue, true)
page.handleContinue({ timeStamp: 1000 })
assert.equal(page.data.currentQuestion, 1)
assert.equal(page.data.questionNumber, 2)
page.handlePrevious({ timeStamp: 2000 })
assert.equal(page.data.currentQuestion, 0)
assert.equal(page.data.questionNumber, 1)

for (let index = 0; index < 8; index += 1) {
  assert.equal(page.data.currentQuestion, index)
  page.chooseAnswer({ currentTarget: { dataset: { value: page.data.responseOptions[0].value } } })
  page.handleContinue({ timeStamp: 3000 + index * 500 })
}
assert.equal(redirectedTo, '/pages/chapter-insight/index?chapter=C1')
assert.equal(storage.get('serious_match_assessment_v2').currentChapterId, 'C2')

console.log('Questionnaire page OK: answer, next, previous, chapter completion')
