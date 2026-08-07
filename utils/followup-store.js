const KEY = 'serious_match_followup_v21'
const CONSENT_VERSION = 'followup-consent-2.1.0'

function empty() { return { participant: {}, contact: {}, consents: {}, consentEvents: [] } }
function get() {
  const value = wx.getStorageSync(KEY)
  return value && typeof value === 'object' ? Object.assign(empty(), value) : empty()
}
function save(value) { wx.setStorageSync(KEY, value); return value }
function event(scope, value) {
  return { eventId: `consent.${scope}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`, scope, value, createdAt: Date.now(), version: CONSENT_VERSION }
}
function appendConsent(scope, value) {
  const state = get()
  const consentEvent = event(scope, value)
  const consentEvents = (state.consentEvents || []).concat(consentEvent)
  const next = Object.assign({}, state, { consentEvents, consents: Object.assign({}, state.consents, { [scope]: consentEvent }) })
  save(next)
  return consentEvent
}
function saveParticipant(participant, contact) { return save(Object.assign({}, get(), { participant, contact })) }
function clear() { wx.removeStorageSync(KEY); return empty() }

module.exports = { CONSENT_VERSION, get, save, appendConsent, saveParticipant, clear }
