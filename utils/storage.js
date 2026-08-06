const PROFILE_KEY = 'serious_match_profile_v1'
const SOURCE_KEY = 'serious_match_source_v1'
const EVENTS_KEY = 'serious_match_events_v2'
const CLOUD_SYNC_KEY = 'serious_match_cloud_sync_v1'
const WELCOME_KEY = 'serious_match_welcome_seen_v1'
const WELCOME_VERSION = 2
const LEGACY_CLEANUP_KEY = 'serious_match_v2_legacy_cleanup_done'

function clearLegacyAssessmentOnce() {
  if (wx.getStorageSync(LEGACY_CLEANUP_KEY)) return
  ['serious_match_exploration_v1', 'serious_match_record_feedback_v1', 'serious_match_questionnaire_v1'].forEach(key => wx.removeStorageSync(key))
  wx.setStorageSync(LEGACY_CLEANUP_KEY, true)
}

function emptyProfile() {
  return { status: 'draft', currentStep: 1, currentQuestion: 0, basic: {}, relationship: {}, about: {}, contact: {}, consent: {}, createdAt: Date.now(), updatedAt: Date.now() }
}

function getProfile() { clearLegacyAssessmentOnce(); const stored = wx.getStorageSync(PROFILE_KEY); return stored && stored.createdAt ? stored : emptyProfile() }
function hasProfile() { clearLegacyAssessmentOnce(); const stored = wx.getStorageSync(PROFILE_KEY); return Boolean(stored && ['active', 'paused'].includes(stored.status)) }
function saveProfile(profile) { const next = Object.assign({}, profile, { updatedAt: Date.now() }); wx.setStorageSync(PROFILE_KEY, next); return next }
function replaceProfile(profile) { if (!profile || !profile.createdAt) return getProfile(); wx.setStorageSync(PROFILE_KEY, Object.assign({}, profile)); return profile }
function saveSection(section, values, nextStep) { const profile = getProfile(); profile[section] = Object.assign({}, profile[section], values); if (nextStep) { profile.currentStep = nextStep; profile.currentQuestion = 0 } return saveProfile(profile) }
function saveDraft(section, values, step, question) { const profile = getProfile(); if (profile.status !== 'draft') return profile; profile[section] = Object.assign({}, profile[section], values); profile.currentStep = step; profile.currentQuestion = question; return saveProfile(profile) }
function completeProfile(contact, consent) {
  const profile = getProfile()
  const report = wx.getStorageSync('serious_match_report_v2') || {}
  profile.contact = contact
  profile.consent = consent
  profile.matching = Object.assign({}, profile.matching, { activeAssessmentReportId: report._id || '', reportVersion: Number(report.reportVersion) || 0, matchingPoolConsentAt: Number(consent.agreedAt) || Date.now() })
  profile.source = getSource()
  profile.status = profile.status === 'paused' ? 'paused' : 'active'
  profile.currentStep = 5
  profile.currentQuestion = 0
  return saveProfile(profile)
}
function setStatus(status) { const profile = getProfile(); profile.status = status; return saveProfile(profile) }

function clearAssessmentFromProfile() {
  if (!hasProfile()) return getProfile()
  const profile = getProfile()
  profile.status = 'paused'
  profile.matching = Object.assign({}, profile.matching, { activeAssessmentReportId: '', reportVersion: 0 })
  return saveProfile(profile)
}

function deleteMatchingProfile() {
  [PROFILE_KEY, CLOUD_SYNC_KEY].forEach(key => wx.removeStorageSync(key))
}

function deleteProfile() {
  [PROFILE_KEY, SOURCE_KEY, EVENTS_KEY, CLOUD_SYNC_KEY, 'serious_match_assessment_v2', 'serious_match_report_v2', 'serious_match_assessment_storage_choice_v2', 'serious_match_exploration_v1', 'serious_match_record_feedback_v1', 'serious_match_questionnaire_v1'].forEach(key => wx.removeStorageSync(key))
}

function getCloudSync() { return wx.getStorageSync(CLOUD_SYNC_KEY) || {} }
function markCloudSynced(profile, syncedAt = Date.now()) { const sync = { profileUpdatedAt: Number(profile && profile.updatedAt) || 0, syncedAt: Number(syncedAt) || Date.now() }; wx.setStorageSync(CLOUD_SYNC_KEY, sync); return sync }
function needsCloudSync(profile = getProfile()) { if (!profile || !['active', 'paused'].includes(profile.status)) return false; return Number(getCloudSync().profileUpdatedAt) !== Number(profile.updatedAt) }
function saveSource(source) { if (!wx.getStorageSync(SOURCE_KEY)) wx.setStorageSync(SOURCE_KEY, String(source).slice(0, 32)) }
function getSource() { return wx.getStorageSync(SOURCE_KEY) || 'direct' }
function hasSeenWelcome() { return wx.getStorageSync(WELCOME_KEY) === WELCOME_VERSION }
function markWelcomeSeen() { wx.setStorageSync(WELCOME_KEY, WELCOME_VERSION) }
function recordEvent(name, details) { const events = wx.getStorageSync(EVENTS_KEY) || []; const event = { name, source: getSource(), at: Date.now() }; if (details && typeof details === 'object') event.details = details; events.push(event); wx.setStorageSync(EVENTS_KEY, events.slice(-100)) }

module.exports = { getProfile, hasProfile, replaceProfile, saveSection, saveDraft, completeProfile, setStatus, clearAssessmentFromProfile, deleteMatchingProfile, deleteProfile, markCloudSynced, needsCloudSync, saveSource, hasSeenWelcome, markWelcomeSeen, recordEvent }
