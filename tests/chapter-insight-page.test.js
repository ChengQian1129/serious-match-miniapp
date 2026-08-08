const assert = require('node:assert/strict')

const storage = new Map()
let redirectedTo = ''
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  getWindowInfo() { return { statusBarHeight: 20 } },
  redirectTo(options) { redirectedTo = options.url; if (options.success) options.success({}) },
  reLaunch() {},
  showToast() {}
}

const { ITEMS, CHAPTERS } = require('../utils/assessment-v2/questionnaire-definitions')
const { CONTENT_VERSION } = require('../shared/content/version')
const store = require('../utils/assessment-v2/session-store')
CHAPTERS.forEach(chapter => {
  chapter.itemIds.forEach((itemId, index) => {
    const item = ITEMS.find(current => current.id === itemId)
    store.answerItem(itemId, item.reverseScored ? 1 : 5, { chapterId: chapter.id, itemIndex: index })
  })
  store.completeChapter(chapter.id)
})

let definition
global.Page = value => { definition = value }
require('../pages/chapter-insight/index.js')
const page = Object.assign({}, definition, {
  data: JSON.parse(JSON.stringify(definition.data)),
  setData(values) { Object.assign(this.data, values) }
})

page.onLoad({ chapter: 'C6' })
assert.equal(page.data.nextChapter, null)
page.chooseFeedback({ currentTarget: { dataset: { value: 'fits' } } })
assert.equal(store.getSession().chapterFeedback.C6.value, 'fits')
assert.equal(store.getSession().chapterFeedback.C6.contentVersion, CONTENT_VERSION)
page.continueNext()
assert.equal(redirectedTo, '/pages/questionnaire-result/index')
assert.ok(store.getReport())
assert.equal(store.getReport().reportVersion, 1)

console.log('Chapter insight page OK: C6 feedback precedes report generation')
