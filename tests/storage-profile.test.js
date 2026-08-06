const assert = require('node:assert/strict')

const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const profileStore = require('../utils/storage')
assert.equal(profileStore.hasProfile(), false)
profileStore.saveDraft('basic', { gender: 'male' }, 1, 1)
assert.equal(profileStore.hasProfile(), false)
const completed = profileStore.completeProfile({ type: 'phone', phone: '13800138000' }, { agreedAt: Date.now() })
assert.equal(completed.status, 'active')
assert.equal(profileStore.hasProfile(), true)
profileStore.setStatus('paused')
assert.equal(profileStore.hasProfile(), true)
profileStore.deleteProfile()
assert.equal(profileStore.hasProfile(), false)

console.log('Profile storage OK: drafts are not treated as submitted profiles')
