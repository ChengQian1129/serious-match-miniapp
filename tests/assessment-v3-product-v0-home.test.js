const assert = require('node:assert/strict')

const storage = new Map()
let failRestore = false
let deferRestore = false
let deferredRestoreSuccess = null
let cloudSession = null
let toastTitle = ''
const cloudCalls = []

global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  showToast(options) { toastTitle = options.title },
  showModal(options) { options.success({ confirm: true }) },
  navigateTo() {},
  cloud: {
    init() {},
    callFunction(options) {
      cloudCalls.push(options.data.action)
      if (options.data.action === 'assessmentGet' && deferRestore) { deferredRestoreSuccess = options.success; return }
      if (options.data.action === 'assessmentGet' && failRestore) return options.fail({ errMsg: 'request:fail network error' })
      if (options.data.action === 'assessmentGet') return options.success({ result: { ok: true, data: { session: cloudSession, report: null } } })
      return options.success({ result: { ok: true, data: { deleted: true } } })
    }
  }
}

let definition
global.Page = value => { definition = value }
const productStore = require('../utils/assessment-v3-product-v0/session-store')
const runtime = require('../shared/assessment-v3-product-v0/runtime-engine')
delete require.cache[require.resolve('../pages/home/index.js')]
require('../pages/home/index.js')
const page = definition
page.setData = function setData(update) { this.data = Object.assign({}, this.data, update) }

productStore.saveSession(runtime.answerItem(productStore.emptySession(100), 'RR01', 1, 101))
page.onShow()
assert.equal(page.data.productHasData, true)
assert.ok(cloudCalls.includes('assessmentGet'))

page.deleteProductData()
assert.equal(page.data.productHasData, false)
assert.equal(productStore.hasSession(), false)
assert.equal(toastTitle, '已删除')
assert.ok(cloudCalls.includes('assessmentDelete'))

cloudSession = Object.assign(runtime.answerItem(productStore.emptySession(200), 'RR01', 1, 201), { status: 'synced', updatedAt: 202 })
productStore.saveReport({ source: 'THEORY_DRIVEN_PRODUCT_V0', title: '不应继续显示' })
page._productRestoreAttempted = false
failRestore = false
page.onProductShow()
assert.equal(productStore.getReport(), null)

failRestore = true
page._productRestoreAttempted = false
page.onProductShow()
assert.ok(page.data.productSyncError)

failRestore = false
deferRestore = true
page._productRestoreAttempted = false
productStore.resetSession()
page.onProductShow()
assert.equal(typeof deferredRestoreSuccess, 'function')
page.handleStart()
deferredRestoreSuccess({ result: { ok: true, data: { session: cloudSession, report: null } } })
assert.equal(productStore.hasSession(), false)
deferRestore = false

productStore.saveSession(runtime.answerItem(productStore.emptySession(300), 'RR01', 1, 301))
page._productRestoreAttempted = false
deferRestore = true
page.onShow()
const staleRestore = deferredRestoreSuccess
assert.equal(typeof staleRestore, 'function')
page.deleteProductData()
assert.equal(productStore.hasSession(), false)
staleRestore({ result: { ok: true, data: { session: cloudSession, report: null } } })
assert.equal(productStore.hasSession(), false)
deferRestore = false

console.log('Product v0 home OK: cloud restore errors and confirmed local/cloud deletion remain user-safe')
