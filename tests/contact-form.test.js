const assert = require('node:assert/strict')

const storage = new Map()
let routedTo = ''
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
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
store.appendConsent('interview_contact', 'granted')

const profile = loadPage('../pages/followup-profile/index.js')
profile.onLoad({ returnTo: 'settings', returnAfter: 'report' })
profile.chooseContactChannel({ currentTarget: { dataset: { value: 'phone' } } })
assert.equal(profile.data.contactField.label, '手机号')
assert.equal(profile.data.contactField.inputType, 'number')

profile.setData({
  form: { displayName: '测试参与者', cityArea: '大连', availability: '周末下午' },
  contact: Object.assign({}, profile.data.contact, { value: '123' })
})
profile.save()
assert.equal(profile.data.error, '手机号需要填写 7–15 位数字，可包含国家区号')
assert.equal(routedTo, '')

profile.setData({ contact: Object.assign({}, profile.data.contact, { value: '138 0013 8000' }) })
profile.save()
assert.equal(routedTo, '/pages/followup-settings/index?returnTo=report')
assert.equal(store.get().contact.value, '13800138000')

profile.chooseContactChannel({ currentTarget: { dataset: { value: 'email' } } })
assert.equal(profile.data.contact.value, '')
assert.equal(profile.data.contactField.label, '邮箱')
profile.setData({ contact: Object.assign({}, profile.data.contact, { value: 'not-an-email' }) })
profile.save()
assert.equal(profile.data.error, '请填写有效的邮箱地址，例如 name@example.com')

console.log('Contact form OK: channel-specific fields, keyboard hints, normalization, and validation')
