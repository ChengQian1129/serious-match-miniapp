const assert = require('node:assert/strict')

let lastNavigation = null
global.wx = {
  navigateTo(options) { lastNavigation = { method: 'navigateTo', url: options.url }; if (options.success) options.success({}) },
  redirectTo(options) { lastNavigation = { method: 'redirectTo', url: options.url }; if (options.success) options.success({}) },
  reLaunch(options) { lastNavigation = { method: 'reLaunch', url: options.url }; if (options.success) options.success({}) },
  navigateBack(options = {}) { lastNavigation = { method: 'navigateBack' }; if (options.success) options.success({}) }
}

function loadPage(relative) {
  let definition
  global.Page = value => { definition = value }
  const absolute = require.resolve(relative)
  delete require.cache[absolute]
  require(absolute)
  assert.ok(definition, `${relative} did not register a page`)
  definition.setData = function setData(update) { this.data = Object.assign({}, this.data, update) }
  return definition
}

const preview = loadPage('../pages/v3-product-preview/index.js')
assert.equal(require('../pages/v3-product-preview/index.js').personaViews().length, 12)
preview.onLoad({})
assert.equal(lastNavigation.method, 'reLaunch')
assert.equal(lastNavigation.url, '/pages/home/index')

const checkpoint = loadPage('../pages/v3-checkpoint/index.js')
checkpoint.onLoad({ mode: 'product-v0', chapter: 'C1' })
assert.equal(checkpoint.data.chapter.id, 'C1')
assert.equal(checkpoint.data.chapter.dimensionCards.length, 2)
assert.equal(checkpoint.data.hasNext, false)
checkpoint.openEvidence({ currentTarget: { dataset: { dimensionId: checkpoint.data.chapter.dimensionCards[0].id } } })
assert.match(lastNavigation.url, /pages\/v3-result-evidence\/index\?mode=product-v0&dimension=/)
checkpoint._isRouting = false
checkpoint.continueNext()
assert.equal(lastNavigation.url, '/pages/v3-result/index?mode=product-v0&scope=partial')

const result = loadPage('../pages/v3-result/index.js')
result.onLoad({ persona: 'ready_self' })
assert.equal(lastNavigation.method, 'reLaunch')
assert.equal(lastNavigation.url, '/pages/home/index')
result.mode = 'product-v0'
result._isRouting = false
result.openFollowup()
assert.equal(lastNavigation.url, '/pages/followup-intro/index?returnTo=product-v0')

const cloud = require('../utils/cloud')
const productStore = require('../utils/assessment-v3-product-v0/session-store')
const productRuntime = require('../shared/assessment-v3-product-v0/runtime-engine')
const storage = new Map()
global.wx.getStorageSync = key => storage.get(key)
global.wx.setStorageSync = (key, value) => storage.set(key, JSON.parse(JSON.stringify(value)))
global.wx.removeStorageSync = key => storage.delete(key)
const originalCloudReady = cloud.isCloudReady
const originalComplete = cloud.completeProductV0ToCloud
const originalDelete = cloud.deleteProductV0FromCloud
let syncCallbacks
let deleteCallbacks
cloud.isCloudReady = () => true
cloud.completeProductV0ToCloud = (session, callbacks) => { syncCallbacks = callbacks }
cloud.deleteProductV0FromCloud = callbacks => { deleteCallbacks = callbacks }
const completedSession = Object.assign(productRuntime.answerItem(productRuntime.createEmptySession(10), 'RR01', 1, 11), { status: 'completed', completedAt: 12, derivedProfile: {} })
productStore.saveSession(completedSession)
result._productSyncing = false
result._productMutationInFlight = false
result.syncProductReport()
assert.equal(typeof syncCallbacks.success, 'function')
result.requestDelete()
assert.equal(typeof deleteCallbacks.success, 'function')
deleteCallbacks.success({})
assert.equal(productStore.hasSession(), false)
syncCallbacks.success({ session: completedSession, report: { source: 'THEORY_DRIVEN_PRODUCT_V0' } })
assert.equal(productStore.hasSession(), false)
cloud.isCloudReady = originalCloudReady
cloud.completeProductV0ToCloud = originalComplete
cloud.deleteProductV0FromCloud = originalDelete

const evidence = loadPage('../pages/v3-result-evidence/index.js')
evidence.onLoad({ mode: 'product-v0', dimension: 'relationship_readiness' })
assert.equal(evidence.data.finding.title, '开始一段关系的准备')
const invalidEvidence = loadPage('../pages/v3-result-evidence/index.js')
invalidEvidence.onLoad({ mode: 'product-v0', dimension: 'expired_dimension' })
assert.equal(invalidEvidence.data.ready, true)
assert.equal(invalidEvidence.data.finding, null)

console.log('V3 product pages OK: preview, checkpoint, result and evidence routes are walkable')
