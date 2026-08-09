let config
try {
  config = require('../config/cloud')
} catch (error) {
  if (!/Cannot find module/.test(String(error && error.message || ''))) throw error
  config = require('../config/cloud.example')
}

let initialized = false
const { publicError } = require('../shared/content/public-errors')
const ASSESSMENT_ACTIONS = new Set(['assessmentSaveDraft', 'assessmentComplete', 'assessmentGet', 'assessmentHistory', 'assessmentDelete', 'assessmentFeedbackAppend', 'assessmentShareSettings'])
const PARTICIPANT_ACTIONS = new Set(['consentGrant', 'consentRevoke', 'consentList', 'participantUpsert', 'participantGet', 'participantDelete'])

function functionFor(action) {
  if (ASSESSMENT_ACTIONS.has(action)) return config.assessmentFunction || 'assessmentService'
  if (PARTICIPANT_ACTIONS.has(action)) return config.participantFunction || 'participantService'
  return config.profileFunction || 'datingProfile'
}

function getSetupIssue() {
  if (!config.envId) return '请先配置微信云开发环境 ID'
  if (!config.operatorName) return '请先配置运营主体名称'
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') return '当前微信版本不支持云开发'
  return ''
}

function isCloudReady() {
  return !getSetupIssue()
}

function initCloud() {
  if (initialized) return true
  if (!isCloudReady()) return false
  wx.cloud.init({
    env: config.envId,
    traceUser: true
  })
  initialized = true
  return true
}

function cloudError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function reportCloudFailure(action, error) {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return
  console.warn(`[datingProfile:${action}]`, {
    code: error && error.code || '',
    message: error && (error.errMsg || error.message) || ''
  })
}

function callProfile(action, payload, callbacks = {}) {
  const setupIssue = getSetupIssue()
  if (setupIssue) {
    if (callbacks.fail) callbacks.fail(cloudError('CLOUD_NOT_READY', setupIssue))
    return false
  }

  initCloud()
  wx.cloud.callFunction({
    name: functionFor(action),
    data: Object.assign({ action }, payload || {}),
    success(response) {
      const result = response && response.result
      if (!result || result.ok !== true) {
        const message = result && result.message ? result.message : '云端暂时无法处理请求'
        const error = cloudError(result && result.code || 'CLOUD_RESPONSE_ERROR', message)
        reportCloudFailure(action, error)
        if (callbacks.fail) callbacks.fail(error)
        return
      }
      if (callbacks.success) callbacks.success(result.data || {})
    },
    fail(error) {
      reportCloudFailure(action, error)
      if (callbacks.fail) callbacks.fail(error)
    }
  })
  return true
}

function saveAssessmentDraftToCloud(session, callbacks) {
  return callProfile('assessmentSaveDraft', { session }, callbacks)
}

function completeAssessmentToCloud(session, callbacks) {
  return callProfile('assessmentComplete', { session }, callbacks)
}

function getAssessmentFromCloud(assessmentId, callbacks) {
  return callProfile('assessmentGet', { assessmentId }, callbacks)
}
function getAssessmentHistoryFromCloud(callbacks) {
  return callProfile('assessmentHistory', {}, callbacks)
}

function appendAssessmentFeedbackToCloud(reportId, feedbackEvent, callbacks) {
  return callProfile('assessmentFeedbackAppend', { reportId, feedbackEvent }, callbacks)
}
function saveAssessmentShareSettings(reportId, selectedClaimIds, clientUpdatedAt, callbacks) {
  return callProfile('assessmentShareSettings', { reportId, selectedClaimIds, clientUpdatedAt }, callbacks)
}

function deleteCloudProfile(callbacks) {
  return callProfile('delete', {}, callbacks)
}
function deleteCloudProfileOnly(callbacks) { return callProfile('deleteProfileOnly', {}, callbacks) }
function deleteCloudAssessment(callbacks) { return callProfile('assessmentDelete', {}, callbacks) }
function grantFollowupConsent(consentEvent, callbacks) { return callProfile('consentGrant', { consentEvent }, callbacks) }
function revokeFollowupConsent(consentEvent, callbacks) { return callProfile('consentRevoke', { consentEvent }, callbacks) }
function getFollowupConsents(callbacks) { return callProfile('consentList', {}, callbacks) }
function saveParticipant(participant, contact, write, callbacks) { return callProfile('participantUpsert', Object.assign({ participant, contact }, write || {}), callbacks) }
function getParticipant(callbacks) { return callProfile('participantGet', {}, callbacks) }
function deleteParticipant(callbacks) { return callProfile('participantDelete', {}, callbacks) }

function cloudErrorMessage(error) {
  const detail = String(error && (error.errMsg || error.message) || '')
  if (/permission|not authorized|unauthorized|env.*(invalid|not found)|environment.*(invalid|not found)/i.test(detail)) return publicError('generic')
  if (/collection.*(not exist|does not exist|not found)|collection.*不存在/i.test(detail)) return publicError('loadFailed')
  if (error && ['INVALID_PROFILE', 'INVALID_FEEDBACK', 'INVALID_QUESTIONNAIRE', 'INVALID_ASSESSMENT', 'INVALID_CONSENT', 'CONSENT_CONFLICT', 'CONSENT_REQUIRED', 'INVALID_PARTICIPANT', 'INVALID_SCHEMA', 'STALE_WRITE', 'ASSESSMENT_CONFLICT'].includes(error.code)) return publicError('saveFailed')
  if (error && ['PARTICIPANT_NOT_FOUND', 'CASE_NOT_FOUND', 'INVALID_CASE', 'INVALID_VALIDATION', 'VALIDATION_CONFLICT', 'CONSENT_REVOKED', 'BLIND_PHASE_CLOSED', 'BLIND_REVEAL_REQUIRED', 'INVITE_EXPIRED', 'INVALID_INVITE'].includes(error.code)) return publicError('loadFailed')
  return publicError('network')
}

module.exports = {
  config,
  initCloud,
  isCloudReady,
  getSetupIssue,
  saveAssessmentDraftToCloud,
  completeAssessmentToCloud,
  getAssessmentFromCloud,
  getAssessmentHistoryFromCloud,
  appendAssessmentFeedbackToCloud,
  saveAssessmentShareSettings,
  deleteCloudProfile,
  deleteCloudProfileOnly,
  deleteCloudAssessment,
  grantFollowupConsent,
  revokeFollowupConsent,
  getFollowupConsents,
  saveParticipant,
  getParticipant,
  deleteParticipant,
  cloudErrorMessage
}
