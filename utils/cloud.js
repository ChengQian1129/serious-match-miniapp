const config = require('../config/cloud')

let initialized = false

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
    name: config.profileFunction,
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

function saveProfileToCloud(profile, callbacks) {
  return callProfile('save', { profile }, callbacks)
}

function saveExplorationToCloud(exploration, callbacks) {
  return callProfile('saveExploration', { exploration }, callbacks)
}

function saveRecordFeedbackToCloud(feedback, callbacks) {
  return callProfile('saveRecordFeedback', { feedback }, callbacks)
}

function saveQuestionnaireModuleToCloud(moduleRecord, callbacks) {
  return callProfile('saveQuestionnaireModule', { moduleRecord }, callbacks)
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

function confirmAssessmentClaimToCloud(reportId, claimId, value, note, callbacks) {
  return callProfile('assessmentConfirmClaim', { reportId, claimId, value, note }, callbacks)
}
function createCompareInvite(reportId, callbacks) { return callProfile('compareInviteCreate', { reportId }, callbacks) }
function joinCompareInvite(code, reportId, callbacks) { return callProfile('compareInviteJoin', { code, reportId }, callbacks) }
function getCompareInvite(code, callbacks) { return callProfile('compareGet', { code }, callbacks) }

function getProfileFromCloud(callbacks) {
  return callProfile('get', {}, callbacks)
}

function setCloudStatus(status, clientUpdatedAt, callbacks) {
  return callProfile('setStatus', { status, clientUpdatedAt }, callbacks)
}

function deleteCloudProfile(callbacks) {
  return callProfile('delete', {}, callbacks)
}
function deleteCloudProfileOnly(callbacks) { return callProfile('deleteProfileOnly', {}, callbacks) }
function deleteCloudAssessment(callbacks) { return callProfile('assessmentDelete', {}, callbacks) }

function cloudErrorMessage(error) {
  if (error && error.code === 'CLOUD_NOT_READY') return error.message
  if (error && error.code === 'INVALID_PROFILE') return error.message
  if (error && error.code === 'INVALID_FEEDBACK') return error.message
  if (error && error.code === 'INVALID_QUESTIONNAIRE') return error.message
  if (error && error.code === 'INVALID_ASSESSMENT') return error.message
  if (error && error.code === 'ASSESSMENT_CONFLICT') return error.message
  if (error && error.code === 'INVITE_EXPIRED') return error.message
  if (error && error.code === 'INVALID_INVITE') return error.message
  const detail = String(error && (error.errMsg || error.message) || '')
  if (/collection.*(not exist|does not exist|not found)|collection.*不存在/i.test(detail)) return '云数据库集合尚未建立，请检查 dating_profiles、assessment_sessions、assessment_reports 和 assessment_invites'
  if (/env.*(invalid|not found)|environment.*(invalid|not found)/i.test(detail)) return '云开发环境配置不匹配'
  if (/permission|not authorized|unauthorized/i.test(detail)) return '当前小程序没有云环境访问权限'
  return '云端连接失败，请检查网络后重试'
}

module.exports = {
  config,
  initCloud,
  isCloudReady,
  getSetupIssue,
  saveProfileToCloud,
  saveExplorationToCloud,
  saveRecordFeedbackToCloud,
  saveQuestionnaireModuleToCloud,
  saveAssessmentDraftToCloud,
  completeAssessmentToCloud,
  getAssessmentFromCloud,
  confirmAssessmentClaimToCloud,
  createCompareInvite,
  joinCompareInvite,
  getCompareInvite,
  getProfileFromCloud,
  setCloudStatus,
  deleteCloudProfile,
  deleteCloudProfileOnly,
  deleteCloudAssessment,
  cloudErrorMessage
}
