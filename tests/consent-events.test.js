const assert = require('node:assert/strict')

const memory = new Map()
global.wx = {
  getStorageSync(key) { return memory.get(key) },
  setStorageSync(key, value) { memory.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { memory.delete(key) }
}

const store = require('../utils/followup-store')
const interview = store.appendConsent('interview_contact', 'granted')
const research = store.appendConsent('research_use', 'granted')
store.appendConsent('research_use', 'revoked')
assert.equal(interview.scope, 'interview_contact')
assert.equal(research.value, 'granted')
assert.equal(store.get().consents.interview_contact.value, 'granted')
assert.equal(store.get().consents.research_use.value, 'revoked')
store.saveParticipant({ displayName: 'A' }, { channel: 'wechat', value: 'id' })
assert.equal(store.get().participant.displayName, 'A')
store.clear()
assert.deepEqual(store.get(), { participant: {}, contact: {}, consents: {}, consentEvents: [] })
console.log('Consent events OK: independent scopes, immutable local history, and deletion')
