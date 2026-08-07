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
assert.equal(store.get().consents.research_use.pendingCloud, true)
store.markConsentSynced(research.eventId, { createdAt: research.createdAt })
assert.equal(store.get().consentEvents.find(item => item.eventId === research.eventId).pendingCloud, false)
const pendingResearch = store.get().consents.research_use
store.mergeCloudConsents({ interview_contact: Object.assign({}, interview, { pendingCloud: false }), research_use: { eventId: 'cloud-old', scope: 'research_use', value: 'granted', createdAt: 1 } })
assert.equal(store.get().consents.research_use.eventId, pendingResearch.eventId)
store.saveParticipant({ displayName: 'A' }, { channel: 'wechat', value: 'id' })
assert.equal(store.get().participant.displayName, 'A')
assert.equal(store.get().participantWrite.pendingCloud, true)
const writeId = store.get().participantWrite.idempotencyKey
store.markParticipantSynced({ displayName: 'A' }, { channel: 'wechat', value: 'id' })
assert.equal(store.get().participantWrite.idempotencyKey, writeId)
assert.equal(store.get().participantWrite.pendingCloud, false)
store.clear()
assert.deepEqual(store.get(), { participant: {}, contact: {}, consents: {}, consentEvents: [], participantWrite: null })
console.log('Consent events OK: independent scopes, immutable local history, and deletion')
