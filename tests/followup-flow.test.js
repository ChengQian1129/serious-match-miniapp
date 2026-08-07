const assert = require('node:assert/strict')

const storage = new Map()
let routedTo = ''
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  navigateTo(options) { routedTo = options.url; if (options.success) options.success({}) },
  redirectTo(options) { routedTo = options.url; if (options.success) options.success({}) },
  navigateBack() {},
  reLaunch() {},
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

const store = require('../utils/followup-store')
store.clear()

const intro = loadPage('../pages/followup-intro/index.js')
intro.continue()
assert.equal(routedTo, '/pages/followup-settings/index')

routedTo = ''
const settings = loadPage('../pages/followup-settings/index.js')
settings.onShow()
settings.toggle({ currentTarget: { dataset: { scope: 'research_use' } } })
settings.save()
assert.equal(routedTo, '')
assert.equal(store.get().consents.research_use.value, 'granted')
assert.equal(store.requiresContact(store.get().consents), false)
assert.equal(store.get().participant.displayName, undefined)

settings.toggle({ currentTarget: { dataset: { scope: 'interview_contact' } } })
settings.save()
assert.equal(routedTo, '/pages/followup-profile/index')

routedTo = ''
const cloud = require('../utils/cloud')
let participantCloudWrite = null
cloud.isCloudReady = () => true
cloud.saveParticipant = (participant, contact, write, callbacks) => {
  participantCloudWrite = { participant, contact, write }
  callbacks.success({ participant, contact })
}
const profile = loadPage('../pages/followup-profile/index.js')
profile.chooseContactChannel({ currentTarget: { dataset: { value: 'wechat' } } })
assert.equal(profile.data.contact.channel, 'wechat')
profile.setData({
  form: { displayName: '测试参与者', cityArea: '大连', availability: '周末下午' },
  contact: Object.assign({}, profile.data.contact, { value: 'test-id' })
})
profile.save()
const saved = store.get()
assert.equal(routedTo, '/pages/followup-settings/index')
assert.equal(saved.participant.availability, '周末下午')
assert.deepEqual(saved.participant.participationTypes, ['interview', 'research'])
assert.equal(saved.contact.preferredTime, '周末下午')
assert.equal(participantCloudWrite.contact.channel, 'wechat')
assert.equal(participantCloudWrite.write.schemaVersion, 'participant-2.1.0')
assert.equal(store.get().participantWrite.pendingCloud, false)

console.log('Follow-up flow OK: consent first, research without contact, contact profile only when required')
