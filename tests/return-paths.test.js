const assert = require('node:assert/strict')

const storage = new Map()
const calls = []
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  redirectTo(options) { calls.push({ method: 'redirectTo', url: options.url }); if (options.success) options.success({}) },
  navigateTo(options) { calls.push({ method: 'navigateTo', url: options.url }); if (options.success) options.success({}) },
  navigateBack(options = {}) { calls.push({ method: 'navigateBack' }); if (options.success) options.success({}) },
  reLaunch(options) { calls.push({ method: 'reLaunch', url: options.url }); if (options.success) options.success({}) },
  getWindowInfo() { return { statusBarHeight: 20 } },
  showToast() {}
}

function loadPage(modulePath) {
  let definition
  global.Page = value => { definition = value }
  delete require.cache[require.resolve(modulePath)]
  require(modulePath)
  return Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values, callback) { Object.assign(this.data, values); if (callback) callback() }
  })
}

const insight = loadPage('../pages/chapter-insight/index.js')
insight.chapterId = 'C3'
insight.reviewChapter()
assert.deepEqual(calls.pop(), { method: 'redirectTo', url: '/pages/questionnaire/index?chapter=C3&question=7&direction=back' })

const result = loadPage('../pages/questionnaire-result/index.js')
result.openMap()
assert.deepEqual(calls.pop(), { method: 'navigateTo', url: '/pages/relationship-map/index' })

const map = loadPage('../pages/relationship-map/index.js')
map.openReport()
assert.deepEqual(calls.pop(), { method: 'navigateBack' })

console.log('Return paths OK: chapter review, report-to-map, and map-to-report preserve context')
