const PROFILE_KEY = 'serious_match_profile_v1'
const SOURCE_KEY = 'serious_match_source_v1'
const EVENTS_KEY = 'serious_match_events_v1'
const CLOUD_SYNC_KEY = 'serious_match_cloud_sync_v1'
const EXPLORATION_KEY = 'serious_match_exploration_v1'
const RECORD_FEEDBACK_KEY = 'serious_match_record_feedback_v1'
const QUESTIONNAIRE_KEY = 'serious_match_questionnaire_v1'
const {
  EXPLORATION_VERSION,
  LEGACY_EXPLORATION_VERSION,
  buildExplorationResult,
  hasCompleteAnswers,
  questionSetForAnswers
} = require('./exploration')
const { buildRelationshipRecord, CLAIM_IDS } = require('./relationship-record')
const {
  QUESTIONNAIRE_DATA_SCHEMA_VERSION,
  emptyQuestionnaireData,
  appendAnswerEvent,
  completeModule,
  moduleProgress,
  hydrateQuestionnaireData
} = require('./questionnaire-record')

function emptyProfile() {
  return {
    status: 'draft',
    currentStep: 1,
    currentQuestion: 0,
    basic: {},
    relationship: {},
    about: {},
    contact: {},
    consent: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function getProfile() {
  const stored = wx.getStorageSync(PROFILE_KEY)
  return stored && stored.createdAt ? stored : emptyProfile()
}

function hasProfile() {
  const stored = wx.getStorageSync(PROFILE_KEY)
  return Boolean(stored && stored.createdAt)
}

function saveProfile(profile) {
  const next = Object.assign({}, profile, { updatedAt: Date.now() })
  wx.setStorageSync(PROFILE_KEY, next)
  return next
}

function replaceProfile(profile) {
  if (!profile || !profile.createdAt) return getProfile()
  const nextProfile = Object.assign({}, profile)
  const exploration = nextProfile.exploration
  if (exploration && hasCompleteAnswers(exploration.answers)) {
    const questionCount = questionSetForAnswers(exploration.answers).length
    const result = buildExplorationResult(exploration.answers)
    const restoredExploration = Object.assign({}, exploration, {
      version: result.version,
      status: 'saved',
      currentQuestion: questionCount - 1,
      result,
      createdAt: Number(exploration.createdAt) || Date.now(),
      updatedAt: Number(exploration.savedAt) || Date.now()
    })
    wx.setStorageSync(EXPLORATION_KEY, restoredExploration)
    delete nextProfile.exploration
  }
  wx.setStorageSync(PROFILE_KEY, nextProfile)
  return nextProfile
}

function saveSection(section, values, nextStep) {
  const profile = getProfile()
  profile[section] = Object.assign({}, profile[section], values)
  if (nextStep) {
    profile.currentStep = nextStep
    profile.currentQuestion = 0
  }
  return saveProfile(profile)
}

function saveDraft(section, values, step, question) {
  const profile = getProfile()
  if (profile.status !== 'draft') return profile
  profile[section] = Object.assign({}, profile[section], values)
  profile.currentStep = step
  profile.currentQuestion = question
  return saveProfile(profile)
}

function completeProfile(contact, consent) {
  const profile = getProfile()
  const exploration = getExploration()
  profile.contact = contact
  profile.consent = consent
  profile.source = getSource()
  if (hasExploration() && exploration.status === 'saved' && hasCompleteAnswers(exploration.answers)) {
    profile.exploration = {
      version: exploration.version,
      status: 'saved',
      answers: exploration.answers,
      createdAt: exploration.createdAt,
      completedAt: exploration.completedAt,
      savedAt: exploration.savedAt
    }
  }
  profile.status = profile.status === 'paused' ? 'paused' : 'active'
  profile.currentStep = 5
  profile.currentQuestion = 0
  return saveProfile(profile)
}

function setStatus(status) {
  const profile = getProfile()
  profile.status = status
  return saveProfile(profile)
}

function deleteProfile() {
  wx.removeStorageSync(PROFILE_KEY)
  wx.removeStorageSync(SOURCE_KEY)
  wx.removeStorageSync(EVENTS_KEY)
  wx.removeStorageSync(CLOUD_SYNC_KEY)
  wx.removeStorageSync(EXPLORATION_KEY)
  wx.removeStorageSync(RECORD_FEEDBACK_KEY)
  wx.removeStorageSync(QUESTIONNAIRE_KEY)
}

function getQuestionnaireData() {
  const stored = wx.getStorageSync(QUESTIONNAIRE_KEY)
  return stored && stored.schemaVersion === QUESTIONNAIRE_DATA_SCHEMA_VERSION
    ? stored
    : emptyQuestionnaireData()
}

function saveQuestionnaireAnswer(moduleId, itemId, rawValue, options) {
  const result = appendAnswerEvent(getQuestionnaireData(), moduleId, itemId, rawValue, options)
  wx.setStorageSync(QUESTIONNAIRE_KEY, result.data)
  return result
}

function completeQuestionnaireModule(moduleId, completedAt) {
  const next = completeModule(getQuestionnaireData(), moduleId, completedAt)
  wx.setStorageSync(QUESTIONNAIRE_KEY, next)
  return next
}

function getQuestionnaireProgress(moduleId) {
  return moduleProgress(getQuestionnaireData(), moduleId)
}

function replaceQuestionnaireData(questionnaireData) {
  try {
    const next = hydrateQuestionnaireData(questionnaireData)
    wx.setStorageSync(QUESTIONNAIRE_KEY, next)
    return next
  } catch (error) {
    return getQuestionnaireData()
  }
}

function emptyRecordFeedback() {
  return { schemaVersion: 'feedback-1.0', claims: {}, updatedAt: 0 }
}

function getRecordFeedback() {
  const stored = wx.getStorageSync(RECORD_FEEDBACK_KEY)
  return stored && stored.schemaVersion ? stored : emptyRecordFeedback()
}

function replaceRecordFeedback(feedback) {
  if (!feedback || typeof feedback !== 'object') return getRecordFeedback()
  const claims = {}
  CLAIM_IDS.forEach(claimId => {
    const item = feedback.claims && feedback.claims[claimId]
    if (item && ['fits', 'unsure', 'not_fits'].includes(item.value)) {
      claims[claimId] = { value: item.value, updatedAt: Number(item.updatedAt) || Date.now() }
    }
  })
  const next = {
    schemaVersion: 'feedback-1.0',
    claims,
    updatedAt: Number(feedback.updatedAt) || Date.now()
  }
  wx.setStorageSync(RECORD_FEEDBACK_KEY, next)
  return next
}

function saveClaimFeedback(claimId, value) {
  if (!CLAIM_IDS.includes(claimId) || !['fits', 'unsure', 'not_fits'].includes(value)) return getRecordFeedback()
  const feedback = getRecordFeedback()
  const now = Date.now()
  const next = {
    schemaVersion: 'feedback-1.0',
    claims: Object.assign({}, feedback.claims, {
      [claimId]: { value, updatedAt: now }
    }),
    updatedAt: now
  }
  wx.setStorageSync(RECORD_FEEDBACK_KEY, next)
  return next
}

function getRelationshipRecord() {
  return buildRelationshipRecord(
    hasProfile() ? getProfile() : null,
    hasExploration() ? getExploration() : null,
    getRecordFeedback(),
    getQuestionnaireData()
  )
}

function emptyExploration() {
  return {
    version: EXPLORATION_VERSION,
    status: 'draft',
    currentQuestion: 0,
    answers: {},
    result: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function getExploration() {
  const stored = wx.getStorageSync(EXPLORATION_KEY)
  if (!stored || !stored.createdAt) return emptyExploration()
  if (stored.version === LEGACY_EXPLORATION_VERSION && stored.status === 'draft') return emptyExploration()
  return stored
}

function hasExploration() {
  const stored = wx.getStorageSync(EXPLORATION_KEY)
  return Boolean(stored && stored.createdAt)
}

function replaceExploration(exploration) {
  if (!exploration || !hasCompleteAnswers(exploration.answers)) return getExploration()
  const result = buildExplorationResult(exploration.answers)
  const questionCount = questionSetForAnswers(exploration.answers).length
  const next = Object.assign({}, exploration, {
    version: result.version,
    status: 'saved',
    currentQuestion: questionCount - 1,
    result,
    createdAt: Number(exploration.createdAt) || Date.now(),
    updatedAt: Number(exploration.savedAt) || Date.now()
  })
  wx.setStorageSync(EXPLORATION_KEY, next)
  return next
}

function saveExplorationDraft(answers, currentQuestion) {
  const exploration = getExploration()
  if (exploration.status === 'saved') return exploration
  const next = Object.assign({}, exploration, {
    status: 'draft',
    currentQuestion: Number.isInteger(currentQuestion) ? currentQuestion : exploration.currentQuestion,
    answers: Object.assign({}, exploration.answers, answers),
    updatedAt: Date.now()
  })
  wx.setStorageSync(EXPLORATION_KEY, next)
  return next
}

function completeExploration(answers, result) {
  const exploration = getExploration()
  if (exploration.status === 'saved') return exploration
  const next = Object.assign({}, exploration, {
    version: result && result.version || EXPLORATION_VERSION,
    status: 'complete',
    currentQuestion: questionSetForAnswers(answers).length - 1,
    answers: Object.assign({}, exploration.answers, answers),
    result,
    completedAt: Date.now(),
    updatedAt: Date.now()
  })
  wx.setStorageSync(EXPLORATION_KEY, next)
  return next
}

function markExplorationSaved() {
  const exploration = getExploration()
  if (exploration.status === 'saved') return exploration
  const next = Object.assign({}, exploration, {
    status: 'saved',
    savedAt: Date.now(),
    updatedAt: Date.now()
  })
  wx.setStorageSync(EXPLORATION_KEY, next)
  return next
}

function getCloudSync() {
  return wx.getStorageSync(CLOUD_SYNC_KEY) || {}
}

function markCloudSynced(profile, syncedAt = Date.now()) {
  const sync = {
    profileUpdatedAt: Number(profile && profile.updatedAt) || 0,
    syncedAt: Number(syncedAt) || Date.now()
  }
  wx.setStorageSync(CLOUD_SYNC_KEY, sync)
  return sync
}

function needsCloudSync(profile = getProfile()) {
  if (!profile || !['active', 'paused'].includes(profile.status)) return false
  const sync = getCloudSync()
  return Number(sync.profileUpdatedAt) !== Number(profile.updatedAt)
}

function saveSource(source) {
  if (!wx.getStorageSync(SOURCE_KEY)) {
    wx.setStorageSync(SOURCE_KEY, String(source).slice(0, 32))
  }
}

function getSource() {
  return wx.getStorageSync(SOURCE_KEY) || 'direct'
}

function recordEvent(name, details) {
  const events = wx.getStorageSync(EVENTS_KEY) || []
  const event = { name, source: getSource(), at: Date.now() }
  if (details && typeof details === 'object') event.details = details
  events.push(event)
  wx.setStorageSync(EVENTS_KEY, events.slice(-100))
}

module.exports = {
  getProfile,
  hasProfile,
  getExploration,
  hasExploration,
  replaceExploration,
  saveExplorationDraft,
  completeExploration,
  markExplorationSaved,
  getRelationshipRecord,
  getRecordFeedback,
  replaceRecordFeedback,
  saveClaimFeedback,
  getQuestionnaireData,
  saveQuestionnaireAnswer,
  completeQuestionnaireModule,
  getQuestionnaireProgress,
  replaceQuestionnaireData,
  replaceProfile,
  saveSection,
  saveDraft,
  completeProfile,
  setStatus,
  deleteProfile,
  markCloudSynced,
  needsCloudSync,
  saveSource,
  recordEvent
}
