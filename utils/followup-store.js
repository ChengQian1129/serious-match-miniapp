const KEY = 'serious_match_followup_v21'
const CONSENT_VERSION = 'followup-consent-2.1.0'

function empty() { return { participant: {}, contact: {}, consents: {}, consentEvents: [], participantWrite: null } }
const PARTICIPATION_BY_SCOPE = Object.freeze({ interview_contact: 'interview', research_use: 'research', offline_invitation: 'offline' })
function get() {
  const value = wx.getStorageSync(KEY)
  return value && typeof value === 'object' ? Object.assign(empty(), value) : empty()
}
function save(value) { wx.setStorageSync(KEY, value); return value }
function event(scope, value) {
  return { eventId: `consent.${scope}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`, scope, value, createdAt: Date.now(), version: CONSENT_VERSION, pendingCloud: true }
}
function appendConsent(scope, value) {
  const state = get()
  const consentEvent = event(scope, value)
  const consentEvents = (state.consentEvents || []).concat(consentEvent)
  const next = Object.assign({}, state, { consentEvents, consents: Object.assign({}, state.consents, { [scope]: consentEvent }) })
  save(next)
  return consentEvent
}
function saveParticipant(participant, contact) {
  const now = Date.now()
  const participantWrite = { clientUpdatedAt: now, idempotencyKey: `participant.${now}.${Math.random().toString(36).slice(2, 8)}`, schemaVersion: 'participant-2.1.0', pendingCloud: true }
  return save(Object.assign({}, get(), { participant, contact, participantWrite }))
}
function markParticipantSynced(participant, contact) {
  const state = get()
  return save(Object.assign({}, state, { participant: participant || state.participant, contact: contact || state.contact, participantWrite: state.participantWrite ? Object.assign({}, state.participantWrite, { pendingCloud: false }) : null }))
}
function markConsentSynced(eventId, cloudEvent) {
  const state = get()
  const consentEvents = (state.consentEvents || []).map(item => item.eventId === eventId ? Object.assign({}, item, cloudEvent || {}, { pendingCloud: false }) : item)
  const consents = Object.assign({}, state.consents)
  Object.keys(consents).forEach(scope => {
    if (consents[scope] && consents[scope].eventId === eventId) consents[scope] = Object.assign({}, consents[scope], cloudEvent || {}, { pendingCloud: false })
  })
  return save(Object.assign({}, state, { consentEvents, consents }))
}
function mergeCloudConsents(cloudConsents) {
  const state = get()
  const pending = Object.values(state.consents || {}).filter(item => item && item.pendingCloud)
  const consents = Object.assign({}, cloudConsents || {})
  pending.forEach(item => { consents[item.scope] = item })
  return save(Object.assign({}, state, { consents }))
}
function granted(consents, scope) { return Boolean(consents && consents[scope] && consents[scope].value === 'granted') }
function participationTypesFromConsents(consents) {
  return Object.entries(PARTICIPATION_BY_SCOPE).filter(([scope]) => granted(consents, scope)).map(([, type]) => type)
}
function requiresContact(consents) { return granted(consents, 'interview_contact') || granted(consents, 'offline_invitation') }
function clear() { wx.removeStorageSync(KEY); return empty() }

module.exports = { CONSENT_VERSION, get, save, appendConsent, saveParticipant, markParticipantSynced, markConsentSynced, mergeCloudConsents, participationTypesFromConsents, requiresContact, clear }
