const assert = require('node:assert/strict')

const storage = new Map()
let settingsSuccess
let profileSuccess
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  navigateTo() {},
  redirectTo() {},
  navigateBack() {},
  reLaunch() {},
  showToast() {},
  cloud: { init() {} }
}

function loadPage(modulePath) {
  let definition
  global.Page = value => { definition = value }
  delete require.cache[require.resolve(modulePath)]
  require(modulePath)
  return Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values, callback) {
      Object.entries(values).forEach(([key, value]) => {
        const match = key.match(/^([^\.]+)\.(.+)$/)
        if (match) this.data[match[1]] = Object.assign({}, this.data[match[1]], { [match[2]]: value })
        else this.data[key] = value
      })
      if (callback) callback()
    }
  })
}

const cloud = require('../utils/cloud')
const store = require('../utils/followup-store')
const originalReady = cloud.isCloudReady
const originalGetParticipant = cloud.getParticipant
cloud.isCloudReady = () => true
store.clear()

cloud.getParticipant = callbacks => { settingsSuccess = callbacks.success }
const settings = loadPage('../pages/followup-settings/index.js')
settings.onShow()
settings.toggle({ currentTarget: { dataset: { scope: 'research_use' } } })
settingsSuccess({ consents: {}, participant: null })
assert.equal(settings.data.scopes.find(item => item.scope === 'research_use').checked, true)

cloud.getParticipant = callbacks => { profileSuccess = callbacks.success }
const profile = loadPage('../pages/followup-profile/index.js')
profile.onShow()
profile.input({ currentTarget: { dataset: { field: 'displayName' } }, detail: { value: '本地刚输入' } })
profileSuccess({ participant: { displayName: '云端旧资料' }, contact: { channel: 'wechat', value: 'old-id' } })
assert.equal(profile.data.form.displayName, '本地刚输入')

cloud.isCloudReady = originalReady
cloud.getParticipant = originalGetParticipant
console.log('Follow-up load race OK: remote hydration cannot overwrite unsaved local edits')
