const cloud = require('wx-server-sdk')
const crypto = require('node:crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const dbCommand = db.command
const profiles = db.collection('dating_profiles')
const assessmentSessions = db.collection('assessment_sessions')
const assessmentReports = db.collection('assessment_reports')
const assessmentFeedbackEvents = db.collection('assessment_feedback_events')
const consentEvents = db.collection('consent_events')
const participantRegistry = db.collection('participant_registry')
const participantContacts = db.collection('participant_contacts')
const interviewCases = db.collection('interview_cases')
const interviewValidationEvents = db.collection('interview_validation_events')
const operatorAccounts = db.collection('operator_accounts')
const auditEvents = db.collection('audit_events')
const { ASSESSMENT_ID, INSTRUMENT_VERSION, ITEMS } = require('./assessment-v2-questionnaire-definitions')
const { validateAnswers, evaluateAssessment } = require('./assessment-v2-scoring-engine')
const { buildReport } = require('./assessment-v2-report-engine')
const { assessResponseQuality } = require('./assessment-v2-quality-engine')
const { HYPOTHESIS_RULE_VERSION, buildInterviewPreparation } = require('./assessment-v2-interview-rules.generated')
const PRIVACY_VERSION = 'cloud-1.0'
const CONSENT_VERSION = 'followup-consent-2.1.0'
const CONSENT_SCOPES = new Set(['interview_contact', 'research_use', 'offline_invitation'])
const CASE_TRANSITIONS = Object.freeze({
  created: new Set(['preparation_ready', 'closed']),
  preparation_ready: new Set(['scheduled', 'closed']),
  scheduled: new Set(['in_progress', 'closed']),
  in_progress: new Set(['completed', 'closed']),
  completed: new Set(['reviewed', 'closed']),
  reviewed: new Set(['closed']),
  closed: new Set()
})
const OPERATOR_ACTIONS = new Set(['participantSearch', 'participantDetail', 'participantContactReveal', 'caseCreate', 'caseGet', 'caseUpdateStatus', 'preparationGenerate', 'validationAppend', 'questionUnderstandingAppend', 'validationList', 'deidentifiedExport', 'pilotMetrics'])

const allowed = {
  gender: new Set(['male', 'female', 'undisclosed']),
  targetGender: new Set(['male', 'female', 'all', 'undisclosed']),
  district: new Set(['high_tech_zone', 'ganjingzi', 'shahekou', 'xigang', 'zhongshan', 'jinpu', 'lvshunkou', 'other_dalian']),
  goal: new Set(['long_term', 'marriage', 'natural', 'open', 'unsure']),
  settlementPlan: new Set(['stay_dalian', 'may_leave', 'decide_together', 'unsure']),
  childPlan: new Set(['want', 'negotiable', 'unsure', 'no', 'skip', '']),
  availability: new Set(['single_ready', 'single_not_ready', 'undisclosed', '']),
  maritalHistory: new Set(['never_married', 'divorced', 'widowed', 'undisclosed', '']),
  childrenStatus: new Set(['none', 'not_living_together', 'living_together', 'undisclosed', '']),
  distanceAcceptance: new Set(['dalian_only', 'nearby', 'temporary_long_distance', 'open', '']),
  smokingStatus: new Set(['never', 'occasionally', 'regularly', 'quitting', 'undisclosed', '']),
  smokingAcceptance: new Set(['never', 'occasionally', 'any', 'open', '']),
  preferencePriority: new Set(['must', 'important', 'discuss', 'not_important', '']),
  commuteTolerance: new Set(['same_district', 'within_30m', 'within_60m', 'flexible', '']),
  schedulePattern: new Set(['regular', 'flexible', 'shift', 'frequent_travel', 'irregular', '']),
  marriageTimeline: new Set(['one_two_years', 'no_fixed_timeline', 'not_soon', 'unsure', '']),
  parentCohabitation: new Set(['separate', 'temporary', 'possible', 'expected', 'discuss', '']),
  financeStyle: new Set(['mostly_separate', 'shared_budget', 'mostly_shared', 'discuss', '']),
  houseworkStyle: new Set(['equal', 'by_strength', 'by_time', 'discuss', '']),
  petAcceptance: new Set(['have_or_want', 'accept', 'depends', 'not_accept', '']),
  alcoholAcceptance: new Set(['none', 'social', 'moderate', 'discuss', '']),
  socialRhythm: new Set(['home_focused', 'balanced', 'social_active', 'flexible', '']),
  meetingTime: new Set(['weekday_daytime', 'weekday_evening', 'weekend_daytime', 'weekend_evening', 'flexible']),
  workStatus: new Set(['full_time', 'freelance', 'business', 'student', 'not_working', 'other', '']),
  industry: new Set(['internet', 'telecom', 'education', 'healthcare', 'finance', 'manufacturing', 'creative', 'business_service', 'public_service', 'other', ''])
}

const explorationVersions = {
  '0.1.0': {
    relationship_progression: new Set(['reassured', 'observe', 'slow_down', 'depends_on_feeling']),
    contact_frequency: new Set(['daily', 'natural', 'spaced', 'meeting_first']),
    emotional_response: new Set(['listen', 'stay', 'solve', 'space']),
    conflict_handling: new Set(['talk_now', 'cool_then_talk', 'let_pass', 'repair_signal'])
  },
  '0.2.0': {
    contact_rhythm: new Set(['frequent_brief', 'daily_clear', 'spaced_deep', 'depends']),
    response_stability: new Set(['light_contact', 'explain_return', 'follow_up', 'no_explanation']),
    emotional_support: new Set(['listen', 'stay', 'solve', 'space']),
    conflict_pause: new Set(['talk_now', 'pause_with_return', 'pause_open', 'confirm_relationship']),
    relationship_pace: new Set(['clarify_early', 'steady_natural', 'slow_space', 'depends'])
  }
}

const recordClaimIds = new Set([
  'exploration.preliminary',
  'exploration.relationship_progression',
  'exploration.contact_and_response',
  'exploration.conflict_handling',
  'current_relationship_readiness.readiness_intent',
  'current_relationship_readiness.available_capacity',
  'current_relationship_readiness.early_uncertainty',
  'current_relationship_readiness.autonomous_motivation',
  'intimate_interaction_style.uncertainty_sensitivity',
  'intimate_interaction_style.closeness_discomfort',
  'intimate_interaction_style.reg01',
  'intimate_interaction_style.reg02',
  'intimate_interaction_style.reg03',
  'intimate_interaction_style.reg04',
  'needs_and_provision.contact_rhythm',
  'needs_and_provision.response_predictability',
  'needs_and_provision.emotional_support',
  'needs_and_provision.autonomy_space',
  'needs_and_provision.conflict_pause',
  'needs_and_provision.repair_reengagement'
])
const recordFeedbackValues = new Set(['fits', 'unsure', 'not_fits'])
const QUESTIONNAIRE_DATA_SCHEMA_VERSION = 'questionnaire-data-1.0'
const numericValues = new Set([1, 2, 3, 4, 5, 'SKIP'])
const experiencedValues = new Set([1, 2, 3, 4, 5, 'NA', 'SKIP'])

function assessmentDocId(openid, assessmentId) {
  return `${openid}_${String(assessmentId || '').replace(/[^a-zA-Z0-9_.-]/g, '')}`.slice(0, 128)
}

function sanitizeAssessmentSession(source, openid) {
  if (!source || source.assessmentType !== ASSESSMENT_ID || source.instrumentVersion !== INSTRUMENT_VERSION) reject('关系探索版本无效', 'INVALID_ASSESSMENT')
  const answers = validateAnswers(source.answers || {})
  const assessmentId = text(source.assessmentId, 100)
  if (!assessmentId) reject('关系探索编号无效', 'INVALID_ASSESSMENT')
  const chapterFeedback = {}
  Object.entries(source.chapterFeedback || {}).forEach(([chapterId, feedback]) => {
    if (!/^C[1-6]$/.test(chapterId) || !feedback || !['fits', 'partly_fits', 'does_not_fit', 'unsure'].includes(feedback.value)) reject('阶段发现核对记录无效', 'INVALID_ASSESSMENT')
    if (!Array.isArray(source.completedChapters) || !source.completedChapters.includes(chapterId)) reject('阶段发现对应章节尚未完成', 'INVALID_ASSESSMENT')
    const reviewedAt = Number(feedback.reviewedAt)
    if (!Number.isFinite(reviewedAt) || reviewedAt <= 0) reject('阶段发现核对时间无效', 'INVALID_ASSESSMENT')
    chapterFeedback[chapterId] = { value: feedback.value, note: text(feedback.note, 200), reviewedAt }
  })
  const now = Date.now()
  return {
    _id: assessmentDocId(openid, assessmentId),
    assessmentId,
    _openid: openid,
    assessmentType: ASSESSMENT_ID,
    instrumentVersion: INSTRUMENT_VERSION,
    scoringRuleVersion: source.scoringRuleVersion,
    reportRuleVersion: source.reportRuleVersion,
    status: ['draft_local', 'pending_cloud', 'synced', 'report_generated'].includes(source.status) ? source.status : 'pending_cloud',
    currentChapterId: text(source.currentChapterId, 4),
    currentItemIndex: Number(source.currentItemIndex) || 0,
    answers,
    answerEvents: Array.isArray(source.answerEvents) ? source.answerEvents.slice(-100) : [],
    itemOrder: ITEMS.map(item => item.id),
    completedChapters: Array.isArray(source.completedChapters) ? source.completedChapters.slice(0, 6) : [],
    chapterFeedback,
    revisionPending: Boolean(source.revisionPending),
    startedAt: Number(source.startedAt) || now,
    clientUpdatedAt: Number(source.updatedAt) || now,
    updatedAt: now,
    completedAt: source.completedAt ? Number(source.completedAt) : null
  }
}

async function findAssessmentSession(openid, assessmentId) {
  try { const result = await assessmentSessions.doc(assessmentDocId(openid, assessmentId)).get(); return result.data || null } catch (error) {
    if (/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) return null
    throw error
  }
}

async function findOwnReport(openid, reportId) {
  if (!reportId) return null
  try {
    const result = await assessmentReports.doc(reportId).get()
    return result.data && result.data._openid === openid ? result.data : null
  } catch (error) {
    if (/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) return null
    throw error
  }
}

function questionnaireItemRules(ids, values) {
  return Object.fromEntries(ids.map(id => [id, values]))
}

const questionnaireModules = {
  current_relationship_readiness: {
    version: '0.1.0',
    items: questionnaireItemRules([
      'RIN01', 'RIN02', 'RIN03', 'RIN04',
      'RCP01', 'RCP02', 'RCP03', 'RCP04',
      'RUN01', 'RUN02', 'RUN03', 'RUN04',
      'RMV01', 'RMV02', 'RMV03', 'RMV04'
    ], numericValues)
  },
  intimate_interaction_style: {
    version: '0.1.0',
    items: questionnaireItemRules([
      'AIS01', 'AIS02', 'AIS03', 'AIS04', 'AIS05', 'AIS06',
      'AVD01', 'AVD02', 'AVD03', 'AVD04', 'AVD05', 'AVD06',
      'REG01', 'REG02', 'REG03', 'REG04'
    ], experiencedValues)
  },
  needs_and_provision: {
    version: '0.1.0',
    items: Object.assign(
      {},
      questionnaireItemRules([
        'CRN01', 'CRN02', 'RPN01', 'RPN02', 'ESN01', 'ESN02',
        'ASN01', 'ASN02', 'CPN01', 'CPN02', 'RRN01', 'RRN02'
      ], numericValues),
      questionnaireItemRules([
        'CRP01', 'CRP02', 'RPP01', 'RPP02', 'ESP01', 'ESP02',
        'ASP01', 'ASP02', 'CPP01', 'CPP02', 'RRP01', 'RRP02'
      ], experiencedValues)
    )
  }
}

function reject(message, code = 'INVALID_PROFILE') {
  const error = new Error(message)
  error.code = code
  throw error
}

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function requireAllowed(group, value, label) {
  if (!allowed[group].has(value)) reject(`${label}不在允许范围内`)
  return value
}

function ageFromBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 0
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return 0
  const now = new Date()
  let age = now.getFullYear() - year
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1
  return age
}

function sanitizeExploration(exploration) {
  if (!exploration) return null
  const rules = explorationVersions[exploration.version]
  if (!rules || exploration.status !== 'saved') reject('关系底图版本无效')
  const answers = exploration.answers || {}
  const cleanAnswers = {}
  Object.keys(rules).forEach(questionId => {
    const answer = answers[questionId]
    if (!rules[questionId].has(answer)) reject('关系底图回答无效')
    cleanAnswers[questionId] = answer
  })
  return {
    version: exploration.version,
    status: 'saved',
    answers: cleanAnswers,
    createdAt: Number(exploration.createdAt) || Date.now(),
    completedAt: Number(exploration.completedAt) || Date.now(),
    savedAt: Number(exploration.savedAt) || Date.now()
  }
}

function sanitizeRecordFeedback(feedback) {
  if (!feedback || typeof feedback !== 'object') reject('缺少关系档案反馈', 'INVALID_FEEDBACK')
  if (feedback.schemaVersion !== 'feedback-1.0') reject('关系档案反馈版本无效', 'INVALID_FEEDBACK')
  const sourceClaims = feedback.claims
  if (!sourceClaims || typeof sourceClaims !== 'object' || Array.isArray(sourceClaims)) {
    reject('关系档案反馈内容无效', 'INVALID_FEEDBACK')
  }

  const claims = {}
  Object.keys(sourceClaims).forEach(claimId => {
    if (!recordClaimIds.has(claimId)) reject('关系档案反馈项目无效', 'INVALID_FEEDBACK')
    const item = sourceClaims[claimId]
    if (!item || !recordFeedbackValues.has(item.value)) reject('关系档案反馈选项无效', 'INVALID_FEEDBACK')
    const updatedAt = item.updatedAt
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) reject('关系档案反馈时间无效', 'INVALID_FEEDBACK')
    claims[claimId] = { value: item.value, updatedAt }
  })

  const updatedAt = feedback.updatedAt
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) reject('关系档案反馈更新时间无效', 'INVALID_FEEDBACK')
  return { schemaVersion: 'feedback-1.0', claims, updatedAt }
}

function sanitizeQuestionnaireModule(moduleRecord) {
  if (!moduleRecord || typeof moduleRecord !== 'object') reject('缺少问卷模块', 'INVALID_QUESTIONNAIRE')
  const moduleId = text(moduleRecord.moduleId, 48)
  const definition = questionnaireModules[moduleId]
  if (!definition || moduleRecord.instrumentVersion !== definition.version) {
    reject('问卷模块或版本无效', 'INVALID_QUESTIONNAIRE')
  }
  if (!['draft', 'complete'].includes(moduleRecord.status)) reject('问卷模块状态无效', 'INVALID_QUESTIONNAIRE')
  if (!Array.isArray(moduleRecord.answerEvents) || moduleRecord.answerEvents.length > 500) {
    reject('问卷回答事件无效', 'INVALID_QUESTIONNAIRE')
  }

  const eventIds = new Set()
  const eventById = new Map()
  const latestByItem = new Map()
  const answerEvents = moduleRecord.answerEvents.map(source => {
    const itemId = text(source && source.itemId, 16)
    const answerEventId = text(source && source.answerEventId, 120)
    const allowedValues = definition.items[itemId]
    if (!allowedValues || !answerEventId || !/^[A-Za-z0-9._-]+$/.test(answerEventId)) {
      reject('问卷回答项目无效', 'INVALID_QUESTIONNAIRE')
    }
    if (eventIds.has(answerEventId)) reject('问卷回答事件重复', 'INVALID_QUESTIONNAIRE')
    if (!allowedValues.has(source.rawValue)) reject('问卷回答值无效', 'INVALID_QUESTIONNAIRE')
    const answeredAt = source.answeredAt
    if (typeof answeredAt !== 'number' || !Number.isFinite(answeredAt) || answeredAt <= 0) {
      reject('问卷回答时间无效', 'INVALID_QUESTIONNAIRE')
    }

    const supersedesAnswerEventId = source.supersedesAnswerEventId == null
      ? null
      : text(source.supersedesAnswerEventId, 120)
    const previousForItem = latestByItem.get(itemId)
    if (previousForItem && supersedesAnswerEventId !== previousForItem.answerEventId) {
      reject('问卷回答修订链无效', 'INVALID_QUESTIONNAIRE')
    }
    if (!previousForItem && supersedesAnswerEventId !== null) {
      reject('问卷回答修订来源无效', 'INVALID_QUESTIONNAIRE')
    }
    if (supersedesAnswerEventId) {
      const superseded = eventById.get(supersedesAnswerEventId)
      if (!superseded || superseded.itemId !== itemId || answeredAt < superseded.answeredAt) {
        reject('问卷回答修订顺序无效', 'INVALID_QUESTIONNAIRE')
      }
    }

    const clean = {
      answerEventId,
      itemId,
      instrumentVersion: definition.version,
      rawValue: source.rawValue,
      answeredAt,
      supersedesAnswerEventId
    }
    eventIds.add(answerEventId)
    eventById.set(answerEventId, clean)
    latestByItem.set(itemId, clean)
    return clean
  })

  if (moduleRecord.status === 'complete' && latestByItem.size !== Object.keys(definition.items).length) {
    reject('问卷还有未回答或未跳过的题目', 'INVALID_QUESTIONNAIRE')
  }
  const createdAt = Number(moduleRecord.createdAt)
  const updatedAt = Number(moduleRecord.updatedAt)
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt) || createdAt <= 0 || updatedAt < createdAt) {
    reject('问卷模块时间无效', 'INVALID_QUESTIONNAIRE')
  }
  const clean = {
    moduleId,
    instrumentVersion: definition.version,
    status: moduleRecord.status,
    answerEvents,
    createdAt,
    updatedAt
  }
  if (moduleRecord.status === 'complete') {
    const completedAt = Number(moduleRecord.completedAt)
    if (!Number.isFinite(completedAt) || completedAt < createdAt) reject('问卷完成时间无效', 'INVALID_QUESTIONNAIRE')
    clean.completedAt = completedAt
  }
  return clean
}

function assertQuestionnaireHistory(existingModule, nextModule) {
  if (!existingModule) return
  if (nextModule.answerEvents.length < existingModule.answerEvents.length) {
    reject('不能删除历史问卷回答', 'INVALID_QUESTIONNAIRE')
  }
  existingModule.answerEvents.forEach((event, index) => {
    if (JSON.stringify(event) !== JSON.stringify(nextModule.answerEvents[index])) {
      reject('不能修改历史问卷回答', 'INVALID_QUESTIONNAIRE')
    }
  })
}

function toClientQuestionnaireData(document) {
  const modules = document && document.questionnaireModules
  if (!modules || typeof modules !== 'object') return null
  const values = Object.values(modules)
  if (!values.length) return null
  return {
    schemaVersion: QUESTIONNAIRE_DATA_SCHEMA_VERSION,
    modules,
    createdAt: Math.min(...values.map(module => Number(module.createdAt) || Date.now())),
    updatedAt: Math.max(...values.map(module => Number(module.updatedAt) || 0))
  }
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') reject('缺少资料')
  if (!['active', 'paused'].includes(profile.status)) reject('资料状态无效')

  const basic = profile.basic || {}
  const relationship = profile.relationship || {}
  const about = profile.about || {}
  const contact = profile.contact || {}
  const consent = profile.consent || {}
  const matching = profile.matching || {}
  const reality = profile.reality || {}
  const exploration = sanitizeExploration(profile.exploration)
  const birthDate = text(basic.birthDate, 10)
  const age = ageFromBirthDate(birthDate)
  if (age < 18 || age > 70) reject('出生日期不符合登记范围')

  const targetAgeMin = Number(relationship.targetAgeMin)
  const targetAgeMax = Number(relationship.targetAgeMax)
  if (!Number.isInteger(targetAgeMin) || !Number.isInteger(targetAgeMax) || targetAgeMin < 18 || targetAgeMax > 70 || targetAgeMin > targetAgeMax) {
    reject('期待年龄范围无效')
  }

  const displayName = text(about.displayName, 12)
  if (!displayName || /^1[3-9]\d{9}$/.test(displayName)) reject('称呼无效')
  const occupation = text(about.occupation, 30)
  if (/1[3-9]\d{9}/.test(occupation) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(occupation)) reject('职业中不能包含联系方式')
  const phone = text(contact.phone, 11)
  if (!/^1[3-9]\d{9}$/.test(phone)) reject('手机号无效')
  if (consent.version !== PRIVACY_VERSION || !Number.isFinite(Number(consent.agreedAt))) reject('缺少有效的隐私同意记录')

  const height = about.heightCm === '' || about.heightCm == null ? '' : Number(about.heightCm)
  if (height !== '' && (!Number.isInteger(height) || height < 140 || height > 220)) reject('身高无效')

  const cleanProfile = {
    status: profile.status,
    basic: {
      gender: requireAllowed('gender', basic.gender, '性别'),
      targetGender: requireAllowed('targetGender', basic.targetGender, '期待性别'),
      targetGenderPriority: requireAllowed('preferencePriority', basic.targetGenderPriority || '', '性别期待优先级'),
      birthDate,
      birthYear: Number(birthDate.slice(0, 4)),
      district: requireAllowed('district', basic.district, '所在区域')
    },
    relationship: {
      goal: requireAllowed('goal', relationship.goal, '关系目标'),
      settlementPlan: requireAllowed('settlementPlan', relationship.settlementPlan, '定居计划'),
      targetAgeMin,
      targetAgeMax,
      agePriority: requireAllowed('preferencePriority', relationship.agePriority || '', '年龄范围优先级'),
      childPlan: requireAllowed('childPlan', relationship.childPlan || '', '孩子计划'),
      childPlanPriority: requireAllowed('preferencePriority', relationship.childPlanPriority || '', '孩子计划优先级'),
      availability: requireAllowed('availability', relationship.availability || '', '关系状态'),
      maritalHistory: requireAllowed('maritalHistory', relationship.maritalHistory || '', '婚姻情况'),
      childrenStatus: requireAllowed('childrenStatus', relationship.childrenStatus || '', '子女情况'),
      distanceAcceptance: requireAllowed('distanceAcceptance', relationship.distanceAcceptance || '', '异地接受度'),
      distancePriority: requireAllowed('preferencePriority', relationship.distancePriority || '', '异地优先级'),
      smokingStatus: requireAllowed('smokingStatus', relationship.smokingStatus || '', '吸烟情况'),
      smokingAcceptance: requireAllowed('smokingAcceptance', relationship.smokingAcceptance || '', '吸烟接受度'),
      smokingPriority: requireAllowed('preferencePriority', relationship.smokingPriority || '', '吸烟边界优先级')
    },
    about: {
      displayName,
      heightCm: height,
      workStatus: requireAllowed('workStatus', about.workStatus || '', '工作状态'),
      industry: requireAllowed('industry', about.industry || '', '行业'),
      occupation
    },
    contact: {
      type: 'phone',
      phone,
      verified: false
    },
    consent: {
      version: PRIVACY_VERSION,
      scope: 'matching_pool_v2',
      agreedAt: Number(consent.agreedAt)
    },
    matching: {
      activeAssessmentReportId: text(matching.activeAssessmentReportId, 128),
      reportVersion: Number(matching.reportVersion) || 0,
      matchingPoolConsentAt: Number(matching.matchingPoolConsentAt) || Number(consent.agreedAt)
    },
    reality: {
      meetingTimes: Array.isArray(reality.meetingTimes) ? [...new Set(reality.meetingTimes)].filter(value => allowed.meetingTime.has(value)).slice(0, 5) : [],
      commuteTolerance: requireAllowed('commuteTolerance', reality.commuteTolerance || '', '通勤范围'),
      schedulePattern: requireAllowed('schedulePattern', reality.schedulePattern || '', '作息情况'),
      marriageTimeline: requireAllowed('marriageTimeline', reality.marriageTimeline || '', '婚育时间期待'),
      parentCohabitation: requireAllowed('parentCohabitation', reality.parentCohabitation || '', '父母同住边界'),
      financeStyle: requireAllowed('financeStyle', reality.financeStyle || '', '财务安排'),
      houseworkStyle: requireAllowed('houseworkStyle', reality.houseworkStyle || '', '家务安排'),
      petAcceptance: requireAllowed('petAcceptance', reality.petAcceptance || '', '宠物边界'),
      alcoholAcceptance: requireAllowed('alcoholAcceptance', reality.alcoholAcceptance || '', '饮酒边界'),
      socialRhythm: requireAllowed('socialRhythm', reality.socialRhythm || '', '社交节奏')
    },
    source: text(profile.source, 32),
    clientCreatedAt: Number(profile.createdAt) || Date.now(),
    clientUpdatedAt: Number(profile.updatedAt) || Date.now()
  }
  if (exploration) cleanProfile.exploration = exploration
  return cleanProfile
}

function toClientProfile(document) {
  if (!document || !['active', 'paused'].includes(document.status)) return null
  return {
    status: document.status,
    currentStep: 5,
    currentQuestion: 0,
    basic: document.basic,
    relationship: document.relationship,
    reality: document.reality || {},
    about: document.about,
    contact: document.contact,
    consent: document.consent,
    matching: document.matching || {},
    createdAt: document.clientCreatedAt,
    updatedAt: document.clientUpdatedAt
  }
}

async function findOwnProfile(openid) {
  try {
    const result = await profiles.doc(openid).get()
    return result.data || null
  } catch (error) {
    if (/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) return null
    throw error
  }
}

async function removeOwnDocuments(collection, openid) {
  try {
    while (true) {
      const result = await collection.where({ _openid: openid }).limit(100).get()
      const documents = result.data || []
      if (!documents.length) return
      await Promise.all(documents.map(document => collection.doc(document._id).remove()))
      if (documents.length < 100) return
    }
  } catch (error) {
    if (/collection.*(does not exist|not exists?|not found)/i.test(error.errMsg || error.message || '')) return
    throw error
  }
}

function feedbackEventDocId(openid, eventId) {
  return (openid + '_' + String(eventId || '').replace(/[^a-zA-Z0-9_.-]/g, '')).slice(0, 128)
}

function sanitizeFeedbackEvent(source, report, openid) {
  if (!source || typeof source !== 'object') reject('缺少报告反馈事件', 'INVALID_FEEDBACK')
  const claimId = text(source.claimId, 80)
  if (!claimId || !(report.claims || []).some(claim => claim.id === claimId)) reject('报告结论不存在', 'INVALID_FEEDBACK')
  const value = text(source.value, 24)
  if (!['fits', 'partly_fits', 'does_not_fit', 'unsure'].includes(value)) reject('报告核对选项无效', 'INVALID_FEEDBACK')
  const eventId = text(source.eventId, 128)
  if (!eventId) reject('报告反馈编号无效', 'INVALID_FEEDBACK')
  const createdAt = Number(source.createdAt)
  if (!Number.isFinite(createdAt) || createdAt <= 0) reject('报告反馈时间无效', 'INVALID_FEEDBACK')
  return {
    _id: feedbackEventDocId(openid, eventId),
    _openid: openid,
    eventId,
    reportId: report._id,
    claimId,
    value,
    note: text(source.note, 200),
    context: text(source.context, 200),
    createdAt,
    supersedesFeedbackId: text(source.supersedesFeedbackId, 128) || null,
    instrumentVersion: report.instrumentVersion,
    reportRuleVersion: report.reportRuleVersion
  }
}

function confirmationProjection(report, event) {
  const current = Object.assign({}, report.userConfirmations || {})[event.claimId]
  if (current && (Number(current.reviewedAt) > Number(event.createdAt) || (Number(current.reviewedAt) === Number(event.createdAt) && String(current.feedbackId) > String(event.eventId)))) return report.userConfirmations || {}
  return Object.assign({}, report.userConfirmations || {}, {
    [event.claimId]: { value: event.value, note: event.note, context: event.context, reviewedAt: event.createdAt, feedbackId: event.eventId }
  })
}

function confirmationProjectionFromEvents(events) {
  return (events || []).slice().sort((left, right) => Number(left.createdAt) - Number(right.createdAt) || String(left.eventId).localeCompare(String(right.eventId))).reduce((projection, event) => confirmationProjection({ userConfirmations: projection }, event), {})
}

function sameFeedbackEvent(left, right) {
  return ['_openid', 'eventId', 'reportId', 'claimId', 'value', 'note', 'context', 'createdAt', 'supersedesFeedbackId', 'instrumentVersion', 'reportRuleVersion'].every(key => left[key] === right[key])
}

function consentDocId(openid, eventId) {
  return (openid + '_' + String(eventId || '').replace(/[^a-zA-Z0-9_.-]/g, '')).slice(0, 128)
}

function sanitizeConsentEvent(source, openid, value) {
  if (!source || typeof source !== 'object') reject('Missing consent event', 'INVALID_CONSENT')
  const scope = text(source.scope, 48)
  if (!CONSENT_SCOPES.has(scope)) reject('Invalid consent scope', 'INVALID_CONSENT')
  const eventId = text(source.eventId, 128)
  const createdAt = Number(source.createdAt)
  if (!eventId || !Number.isFinite(createdAt) || createdAt <= 0) reject('Invalid consent event', 'INVALID_CONSENT')
  return { _id: consentDocId(openid, eventId), _openid: openid, eventId, scope, value, version: CONSENT_VERSION, createdAt }
}

async function ownConsentEvents(openid) {
  try {
    const result = await consentEvents.where({ _openid: openid }).limit(100).get()
    return (result.data || []).sort((left, right) => Number(left.createdAt) - Number(right.createdAt) || String(left.eventId).localeCompare(String(right.eventId)))
  } catch (error) {
    if (/collection.*(does not exist|not exists?|not found)/i.test(error.errMsg || error.message || '')) return []
    throw error
  }
}

function consentProjection(events) {
  return (events || []).reduce((result, event) => {
    const current = result[event.scope]
    if (!current || Number(current.createdAt) < Number(event.createdAt) || (Number(current.createdAt) === Number(event.createdAt) && String(current.eventId) < String(event.eventId))) result[event.scope] = event
    return result
  }, {})
}

async function hasActiveConsent(openid, scope) {
  const projection = consentProjection(await ownConsentEvents(openid))
  return Boolean(projection[scope] && projection[scope].value === 'granted')
}

function sanitizeParticipant(source) {
  if (!source || typeof source !== 'object') reject('Missing participant profile', 'INVALID_PARTICIPANT')
  const participationTypes = [...new Set((Array.isArray(source.participationTypes) ? source.participationTypes : []).map(value => text(value, 48)).filter(Boolean))].slice(0, 8)
  const availability = text(source.availability, 80)
  const cityArea = text(source.cityArea, 80)
  const displayName = text(source.displayName, 40)
  if (!displayName || !cityArea || !availability || !participationTypes.length) reject('Required participant fields are missing', 'INVALID_PARTICIPANT')
  return { displayName, cityArea, availability, participationTypes, ageRange: text(source.ageRange, 40), relationshipStatus: text(source.relationshipStatus, 40), relationshipHistory: text(source.relationshipHistory, 40), interviewPreference: text(source.interviewPreference, 40), note: text(source.note, 500) }
}

function sanitizeContact(source) {
  if (!source || typeof source !== 'object') reject('Missing contact details', 'INVALID_PARTICIPANT')
  const channel = text(source.channel, 32)
  const value = text(source.value, 160)
  const preferredTime = text(source.preferredTime, 80)
  if (!channel || !value || !preferredTime) reject('Required contact fields are missing', 'INVALID_PARTICIPANT')
  return { channel, value, preferredTime }
}

async function findOperator(openid) {
  try { return (await operatorAccounts.doc(openid).get()).data || null } catch (error) {
    if (/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) return null
    throw error
  }
}

async function requireOperator(openid, roles) {
  const account = await findOperator(openid)
  if (!account || account.status === 'disabled' || !roles.includes(account.role)) reject('Operator access is required', 'UNAUTHORIZED_OPERATOR')
  return account
}

function operatorDocId(openid, value) { return (openid + '_' + String(value || '').replace(/[^a-zA-Z0-9_.-]/g, '')).slice(0, 128) }
function deidentifiedKey(namespace, value) { return namespace + '_' + crypto.createHash('sha256').update(namespace + ':' + String(value || '')).digest('hex').slice(0, 32) }
function maskedContact(value) {
  const source = String(value || '')
  if (!source) return ''
  if (/^1\d{10}$/.test(source)) return source.slice(0, 3) + '****' + source.slice(-4)
  if (source.length <= 2) return '*'.repeat(source.length)
  return source.slice(0, 1) + '***' + source.slice(-1)
}

async function appendAudit(openid, action, targetId, result, metadata) {
  const now = Date.now()
  const auditId = operatorDocId(openid, action + '.' + targetId + '.' + now + '.' + crypto.randomBytes(6).toString('hex'))
  await auditEvents.doc(auditId).set({ data: {
    _id: auditId, _openid: openid, actorOpenid: openid, action, targetId: text(targetId, 128), result: text(result, 40), metadata: metadata && typeof metadata === 'object' ? { role: text(metadata.role, 32), count: Number(metadata.count) || 0, errorCode: text(metadata.errorCode, 48) } : {}, createdAt: now
  } })
}

async function findParticipantRecord(participantId) {
  try { return (await participantRegistry.doc(participantId).get()).data || null } catch (error) {
    if (/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) return null
    throw error
  }
}

async function findCase(caseId) {
  try { return (await interviewCases.doc(caseId).get()).data || null } catch (error) {
    if (/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) return null
    throw error
  }
}

function caseAccess(account, caseDocument, openid) {
  return account.role === 'admin' || caseDocument.assignedOperatorOpenid === openid
}

async function requireCaseAccess(openid, caseId, roles) {
  const account = await requireOperator(openid, roles)
  const caseDocument = await findCase(text(caseId, 128))
  if (!caseDocument) reject('Interview case not found', 'CASE_NOT_FOUND')
  if (!caseAccess(account, caseDocument, openid)) reject('Case is not assigned to this operator', 'UNAUTHORIZED_OPERATOR')
  return { account, caseDocument }
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_OPENID', message: '无法确认微信身份' }

  // The 2.1 public app no longer accepts profile or matching-pool writes.
  // Legacy records remain addressable only through the migration/deletion path.
  if ([
    'save',
    'get',
    'setStatus',
    'saveExploration',
    'saveRecordFeedback',
    'saveQuestionnaireModule',
    'assessmentConfirmClaim',
    'compareInviteCreate',
    'compareInviteJoin',
    'compareGet'
  ].includes(event.action)) {
    return { ok: false, code: 'UNKNOWN_ACTION', message: '不支持的操作' }
  }

  try {
    if (event.action === 'participantSearch') {
      const account = await requireOperator(OPENID, ['admin'])
      const result = await participantRegistry.where({ status: 'active' }).limit(100).get()
      const cityArea = text(event.filters && event.filters.cityArea, 80)
      const participationType = text(event.filters && event.filters.participationType, 48)
      const participants = (result.data || []).filter(item => (!cityArea || item.cityArea === cityArea) && (!participationType || (item.participationTypes || []).includes(participationType))).slice(0, 50).map(item => ({ _id: item._id, displayName: item.displayName, cityArea: item.cityArea, availability: item.availability, participationTypes: item.participationTypes || [], status: item.status, updatedAt: item.updatedAt }))
      await appendAudit(OPENID, 'participantSearch', 'participants', 'success', { role: account.role, count: participants.length })
      return { ok: true, data: { participants } }
    }

    if (event.action === 'caseCreate') {
      const account = await requireOperator(OPENID, ['admin'])
      const participantId = text(event.participantId, 128)
      const participant = await findParticipantRecord(participantId)
      if (!participant || participant.status !== 'active') reject('Active participant not found', 'PARTICIPANT_NOT_FOUND')
      const consents = consentProjection(await ownConsentEvents(participantId))
      if (!consents.interview_contact || consents.interview_contact.value !== 'granted') reject('Participant contact consent is not active', 'CONSENT_REVOKED')
      const reports = await assessmentReports.where({ _openid: participantId }).limit(20).get()
      const report = (reports.data || []).sort((left, right) => Number(right.generatedAt) - Number(left.generatedAt))[0] || null
      if (!report) reject('Participant assessment report not found', 'INVALID_ASSESSMENT')
      const now = Date.now()
      const assignedOperatorOpenid = text(event.assignedOperatorOpenid, 128) || OPENID
      const assignedOperator = await findOperator(assignedOperatorOpenid)
      if (!assignedOperator || assignedOperator.status === 'disabled' || !['interviewer', 'admin'].includes(assignedOperator.role)) reject('Assigned interviewer is invalid', 'INVALID_CASE')
      const idempotencyKey = text(event.idempotencyKey, 128)
      const caseId = text(event.caseId, 128) || (idempotencyKey ? deidentifiedKey('case', idempotencyKey) : `case.${now}.${crypto.randomBytes(6).toString('hex')}`)
      const existingCase = await findCase(caseId)
      if (existingCase) {
        if (existingCase.participantId === participantId && existingCase.assignedOperatorOpenid === assignedOperatorOpenid) return { ok: true, data: { case: existingCase, duplicateIgnored: true } }
        reject('Case idempotency key is already used', 'INVALID_CASE')
      }
      const reportSnapshot = { reportId: report._id, assessmentId: report.assessmentId, reportVersion: report.reportVersion, instrumentVersion: report.instrumentVersion, scoringRuleVersion: report.scoringRuleVersion, reportRuleVersion: report.reportRuleVersion, generatedAt: report.generatedAt, claims: report.claims || [], allClaimCandidates: report.allClaimCandidates || report.claims || [], visibleClaimIds: report.visibleClaimIds || (report.claims || []).map(claim => claim.id), unknowns: report.unknowns || [], userConfirmations: report.userConfirmations || {}, responseQuality: report.responseQuality || null }
      const caseDocument = { _id: caseId, participantId, assignedOperatorOpenid, status: 'created', reportSnapshot, participantSnapshot: { cityArea: participant.cityArea, availability: participant.availability, participationTypes: participant.participationTypes || [] }, createdAt: now, updatedAt: now }
      await interviewCases.doc(caseId).set({ data: caseDocument })
      await appendAudit(OPENID, 'caseCreate', caseId, 'success', { role: account.role })
      return { ok: true, data: { case: caseDocument } }
    }

    if (event.action === 'participantDetail') {
      const account = await requireOperator(OPENID, ['interviewer', 'admin'])
      const participantId = text(event.participantId, 128)
      const participant = await findParticipantRecord(participantId)
      if (!participant) reject('Participant not found', 'PARTICIPANT_NOT_FOUND')
      if (account.role !== 'admin') {
        const cases = await interviewCases.where({ participantId, assignedOperatorOpenid: OPENID }).limit(1).get()
        if (!(cases.data || []).length) reject('Participant is not assigned to this operator', 'UNAUTHORIZED_OPERATOR')
      }
      const contact = await participantContacts.doc(participant.contactRef || participantId).get().then(result => result.data || null).catch(error => /does not exist|not exists?|not found/i.test(error.errMsg || error.message || '') ? null : Promise.reject(error))
      await appendAudit(OPENID, 'participantDetail', participantId, 'success', { role: account.role })
      return { ok: true, data: { participant: { _id: participant._id, displayName: participant.displayName, cityArea: participant.cityArea, availability: participant.availability, participationTypes: participant.participationTypes || [], status: participant.status }, contact: contact ? { channel: contact.channel, maskedValue: maskedContact(contact.value), preferredTime: contact.preferredTime } : null } }
    }

    if (event.action === 'participantContactReveal') {
      const account = await requireOperator(OPENID, ['interviewer', 'admin'])
      const participantId = text(event.participantId, 128)
      const participant = await findParticipantRecord(participantId)
      if (!participant) reject('Participant not found', 'PARTICIPANT_NOT_FOUND')
      if (participant.status === 'withdrawn' || !(await hasActiveConsent(participantId, 'interview_contact'))) reject('Participant contact consent is not active', 'CONSENT_REVOKED')
      if (account.role !== 'admin') {
        const cases = await interviewCases.where({ participantId, assignedOperatorOpenid: OPENID }).limit(1).get()
        if (!(cases.data || []).length) reject('Participant is not assigned to this operator', 'UNAUTHORIZED_OPERATOR')
      }
      const contact = await participantContacts.doc(participant.contactRef || participantId).get().then(result => result.data || null).catch(error => /does not exist|not exists?|not found/i.test(error.errMsg || error.message || '') ? null : Promise.reject(error))
      await appendAudit(OPENID, 'participantContactReveal', participantId, 'success', { role: account.role })
      return { ok: true, data: { contact: contact ? { channel: contact.channel, value: contact.value, preferredTime: contact.preferredTime } : null } }
    }

    if (event.action === 'caseGet') {
      const { account, caseDocument } = await requireCaseAccess(OPENID, event.caseId, ['interviewer', 'admin'])
      await appendAudit(OPENID, 'caseGet', caseDocument._id, 'success', { role: account.role })
      return { ok: true, data: { case: caseDocument } }
    }

    if (event.action === 'caseUpdateStatus') {
      const { account, caseDocument } = await requireCaseAccess(OPENID, event.caseId, ['interviewer', 'admin'])
      const status = text(event.status, 32)
      const allowedTransitions = CASE_TRANSITIONS[caseDocument.status]
      if (!allowedTransitions || (status !== caseDocument.status && !allowedTransitions.has(status))) reject('Invalid case status transition', 'INVALID_CASE')
      const updatedAt = Date.now()
      await interviewCases.doc(caseDocument._id).update({ data: { status, updatedAt } })
      await appendAudit(OPENID, 'caseUpdateStatus', caseDocument._id, 'success', { role: account.role })
      return { ok: true, data: { case: Object.assign({}, caseDocument, { status, updatedAt }) } }
    }

    if (event.action === 'preparationGenerate') {
      const { account, caseDocument } = await requireCaseAccess(OPENID, event.caseId, ['interviewer', 'admin'])
      const preparation = buildInterviewPreparation(caseDocument.reportSnapshot, caseDocument.participantSnapshot, Date.now())
      const status = caseDocument.status === 'created' ? 'preparation_ready' : caseDocument.status
      await interviewCases.doc(caseDocument._id).update({ data: { preparation, status, updatedAt: preparation.generatedAt } })
      await appendAudit(OPENID, 'preparationGenerate', caseDocument._id, 'success', { role: account.role, count: preparation.hypotheses.length })
      return { ok: true, data: { preparation } }
    }

    if (event.action === 'validationAppend' || event.action === 'questionUnderstandingAppend') {
      const { account, caseDocument } = await requireCaseAccess(OPENID, event.caseId, ['interviewer', 'admin'])
      const source = event.validationEvent || {}
      const eventId = text(source.eventId, 128)
      const claimId = text(source.claimId, 80)
      const hypothesisId = text(source.hypothesisId, 96) || (claimId ? `HYP_${claimId}` : '')
      const itemId = text(source.itemId, 80)
      const eventType = event.action === 'questionUnderstandingAppend' ? 'question_understanding' : (text(source.eventType, 40) || 'claim_validation')
      const verdict = text(source.verdict, 40)
      const observedAt = Number(source.observedAt)
      const validClaim = (caseDocument.reportSnapshot.allClaimCandidates || caseDocument.reportSnapshot.claims || []).some(claim => claim.id === claimId)
      const validHypothesis = caseDocument.preparation && (caseDocument.preparation.hypotheses || []).some(hypothesis => hypothesis.hypothesisId === hypothesisId && hypothesis.sourceClaimIds.includes(claimId))
      const validItem = ITEMS.some(item => item.id === itemId)
      const validVerdict = eventType === 'question_understanding' ? ['understood', 'misunderstood', 'needs_prompt'].includes(verdict) : ['confirmed', 'partly_confirmed', 'rejected', 'context_dependent', 'insufficient_evidence'].includes(verdict)
      const interviewerConfidence = text(source.interviewerConfidence, 16) || 'medium'
      if (!['high', 'medium', 'low'].includes(interviewerConfidence)) reject('Invalid interviewer confidence', 'INVALID_VALIDATION')
      if (!eventId || (eventType === 'question_understanding' ? !validItem : (!validClaim || !validHypothesis)) || !validVerdict || !Number.isFinite(observedAt)) reject('Invalid validation event', 'INVALID_VALIDATION')
      const validation = { _id: operatorDocId(caseDocument._id, eventId), eventId, eventType, caseId: caseDocument._id, participantId: caseDocument.participantId, hypothesisId: eventType === 'question_understanding' ? null : hypothesisId, claimId: claimId || null, itemId: itemId || null, result: verdict, verdict, evidenceSummary: text(source.evidenceSummary || source.note, 500), alternativeExplanation: text(source.alternativeExplanation, 500), revisedDescription: text(source.revisedDescription, 500), interviewerConfidence, note: text(source.note, 500), context: text(source.context, 300), observedAt, recordedAt: Date.now(), operatorOpenid: OPENID, supersedesValidationId: text(source.supersedesValidationId, 128) || null, instrumentVersion: caseDocument.reportSnapshot.instrumentVersion, scoringRuleVersion: caseDocument.reportSnapshot.scoringRuleVersion, reportRuleVersion: caseDocument.reportSnapshot.reportRuleVersion, hypothesisRuleVersion: HYPOTHESIS_RULE_VERSION }
      let existing = null
      try { existing = (await interviewValidationEvents.doc(validation._id).get()).data || null } catch (error) { if (!/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) throw error }
      if (existing) {
        const same = ['eventId', 'eventType', 'caseId', 'hypothesisId', 'claimId', 'itemId', 'result', 'verdict', 'evidenceSummary', 'alternativeExplanation', 'revisedDescription', 'interviewerConfidence', 'note', 'context', 'observedAt', 'supersedesValidationId'].every(key => existing[key] === validation[key])
        if (!same) reject('Validation event id already used', 'VALIDATION_CONFLICT')
        return { ok: true, data: { validationEvent: existing, duplicateIgnored: true } }
      }
      await interviewValidationEvents.doc(validation._id).set({ data: validation })
      await appendAudit(OPENID, 'validationAppend', caseDocument._id, 'success', { role: account.role })
      return { ok: true, data: { validationEvent: validation } }
    }

    if (event.action === 'validationList') {
      const { account, caseDocument } = await requireCaseAccess(OPENID, event.caseId, ['interviewer', 'admin'])
      const result = await interviewValidationEvents.where({ caseId: caseDocument._id }).limit(100).get()
      const events = (result.data || []).sort((left, right) => Number(left.observedAt) - Number(right.observedAt))
      await appendAudit(OPENID, 'validationList', caseDocument._id, 'success', { role: account.role, count: events.length })
      return { ok: true, data: { events } }
    }

    if (event.action === 'deidentifiedExport') {
      const account = await requireOperator(OPENID, ['analyst', 'admin'])
      const cases = await interviewCases.where({ status: 'completed' }).limit(100).get()
      const consentChecks = await Promise.all((cases.data || []).map(async item => ({ item, allowed: await hasActiveConsent(item.participantId, 'research_use') })))
      const records = await Promise.all(consentChecks.filter(entry => entry.allowed).map(async ({ item }) => {
        const report = item.reportSnapshot || {}
        const validationResult = await interviewValidationEvents.where({ caseId: item._id }).limit(100).get()
        const validations = (validationResult.data || []).map(validation => ({ hypothesisId: validation.hypothesisId || null, claimId: validation.claimId || null, itemId: validation.itemId || null, eventType: validation.eventType, result: validation.result || validation.verdict, interviewerConfidence: validation.interviewerConfidence || null, observedAt: validation.observedAt, instrumentVersion: validation.instrumentVersion, reportRuleVersion: validation.reportRuleVersion, hypothesisRuleVersion: validation.hypothesisRuleVersion }))
        const userConfirmations = Object.fromEntries(Object.entries(report.userConfirmations || {}).map(([claimId, feedback]) => [claimId, { value: feedback.value, reviewedAt: feedback.reviewedAt }]))
        return {
          caseKey: deidentifiedKey('case', item._id),
          participantKey: deidentifiedKey('participant', item.participantId),
          reportSnapshot: {
            reportVersion: report.reportVersion,
            instrumentVersion: report.instrumentVersion,
            scoringRuleVersion: report.scoringRuleVersion,
            reportRuleVersion: report.reportRuleVersion,
            generatedAt: report.generatedAt,
            claims: report.claims || [],
            unknowns: report.unknowns || [],
            userConfirmations,
            responseQuality: report.responseQuality || null
          },
          participantSnapshot: item.participantSnapshot,
          validations,
          status: item.status,
          createdAt: item.createdAt
        }
      }))
      await appendAudit(OPENID, 'deidentifiedExport', 'completed-cases', 'success', { role: account.role, count: records.length })
      return { ok: true, data: { records, exportedAt: Date.now() } }
    }

    if (event.action === 'pilotMetrics') {
      const account = await requireOperator(OPENID, ['analyst', 'admin'])
      const [reportsResult, feedbackResult, casesResult, validationResult] = await Promise.all([
        assessmentReports.where({}).limit(100).get(),
        assessmentFeedbackEvents.where({}).limit(100).get(),
        interviewCases.where({}).limit(100).get(),
        interviewValidationEvents.where({}).limit(100).get()
      ])
      const countBy = (items, key) => (items || []).reduce((result, item) => { const value = item[key] || 'unknown'; result[value] = Number(result[value] || 0) + 1; return result }, {})
      const participantIds = [...new Set([].concat((reportsResult.data || []).map(item => item._openid), (casesResult.data || []).map(item => item.participantId)).filter(Boolean))]
      const consentPairs = await Promise.all(participantIds.map(async participantId => [participantId, await hasActiveConsent(participantId, 'research_use')]))
      const researchParticipants = new Set(consentPairs.filter(([, allowed]) => allowed).map(([participantId]) => participantId))
      const reports = (reportsResult.data || []).filter(item => researchParticipants.has(item._openid))
      const feedback = (feedbackResult.data || []).filter(item => researchParticipants.has(item._openid))
      const cases = (casesResult.data || []).filter(item => researchParticipants.has(item.participantId))
      const validations = (validationResult.data || []).filter(item => researchParticipants.has(item.participantId))
      const metrics = {
        reportCount: reports.length,
        feedbackCount: feedback.length,
        feedbackByValue: countBy(feedback, 'value'),
        caseCount: cases.length,
        caseByStatus: countBy(cases, 'status'),
        preparationGeneratedCount: cases.filter(item => item.preparation && item.preparation.generatedAt).length,
        validationByVerdict: countBy(validations.filter(item => item.eventType !== 'question_understanding'), 'verdict'),
        questionUnderstandingByVerdict: countBy(validations.filter(item => item.eventType === 'question_understanding'), 'verdict'),
        generatedAt: Date.now()
      }
      await appendAudit(OPENID, 'pilotMetrics', 'pilot', 'success', { role: account.role, count: metrics.caseCount })
      return { ok: true, data: { metrics } }
    }

    if (event.action === 'consentGrant' || event.action === 'consentRevoke') {
      const value = event.action === 'consentGrant' ? 'granted' : 'revoked'
      const consentEvent = sanitizeConsentEvent(event.consentEvent, OPENID, value)
      let existing = null
      try { existing = (await consentEvents.doc(consentEvent._id).get()).data || null } catch (error) {
        if (!/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) throw error
      }
      if (existing) {
        const same = ['_openid', 'eventId', 'scope', 'value', 'version', 'createdAt'].every(key => existing[key] === consentEvent[key])
        if (!same) reject('Consent event id already used', 'CONSENT_CONFLICT')
        const projection = consentProjection(await ownConsentEvents(OPENID))
        return { ok: true, data: { consentEvent: existing, consents: projection, duplicateIgnored: true } }
      }
      await consentEvents.doc(consentEvent._id).set({ data: consentEvent })
      const projection = consentProjection(await ownConsentEvents(OPENID))
      if (value === 'revoked' && projection.interview_contact && projection.interview_contact.value === 'revoked') {
        const existingParticipant = await participantRegistry.doc(OPENID).get().then(result => result.data || null).catch(error => /does not exist|not exists?|not found/i.test(error.errMsg || error.message || '') ? null : Promise.reject(error))
        if (existingParticipant) await participantRegistry.doc(OPENID).update({ data: { status: 'withdrawn', updatedAt: Date.now() } })
      }
      return { ok: true, data: { consentEvent, consents: projection } }
    }

    if (event.action === 'consentList') {
      const events = await ownConsentEvents(OPENID)
      return { ok: true, data: { consents: consentProjection(events), events } }
    }

    if (event.action === 'participantUpsert') {
      const participant = sanitizeParticipant(event.participant)
      const contact = sanitizeContact(event.contact)
      const projection = consentProjection(await ownConsentEvents(OPENID))
      if (!projection.interview_contact || projection.interview_contact.value !== 'granted') reject('Interview contact consent is required', 'CONSENT_REQUIRED')
      const now = Date.now()
      const existing = await participantRegistry.doc(OPENID).get().then(result => result.data || null).catch(error => /does not exist|not exists?|not found/i.test(error.errMsg || error.message || '') ? null : Promise.reject(error))
      const idempotencyKey = text(event.idempotencyKey, 128)
      const clientUpdatedAt = Number(event.clientUpdatedAt)
      const schemaVersion = text(event.schemaVersion, 48)
      if (!idempotencyKey || !Number.isFinite(clientUpdatedAt) || clientUpdatedAt <= 0 || schemaVersion !== 'participant-2.1.0') reject('Invalid participant write metadata', 'INVALID_SCHEMA')
      if (existing && existing.lastIdempotencyKey === idempotencyKey) {
        const existingContact = await participantContacts.doc(existing.contactRef || OPENID).get().then(result => result.data || null).catch(error => /does not exist|not exists?|not found/i.test(error.errMsg || error.message || '') ? null : Promise.reject(error))
        return { ok: true, data: { participant: existing, contact: existingContact, consents: projection, savedAt: existing.updatedAt, duplicateIgnored: true } }
      }
      if (existing && Number(existing.clientUpdatedAt) > clientUpdatedAt) reject('Newer participant data already exists', 'STALE_WRITE')
      const registry = Object.assign({}, participant, { _id: OPENID, _openid: OPENID, contactRef: OPENID, status: 'active', consentVersion: CONSENT_VERSION, schemaVersion, clientUpdatedAt, lastIdempotencyKey: idempotencyKey, createdAt: existing && existing.createdAt || now, updatedAt: now })
      await participantRegistry.doc(OPENID).set({ data: registry })
      await participantContacts.doc(OPENID).set({ data: Object.assign({}, contact, { _id: OPENID, _openid: OPENID, schemaVersion, clientUpdatedAt, lastIdempotencyKey: idempotencyKey, updatedAt: now }) })
      return { ok: true, data: { participant: registry, consents: projection, savedAt: now } }
    }

    if (event.action === 'participantGet') {
      const participant = await participantRegistry.doc(OPENID).get().then(result => result.data || null).catch(error => /does not exist|not exists?|not found/i.test(error.errMsg || error.message || '') ? null : Promise.reject(error))
      const contact = await participantContacts.doc(OPENID).get().then(result => result.data || null).catch(error => /does not exist|not exists?|not found/i.test(error.errMsg || error.message || '') ? null : Promise.reject(error))
      return { ok: true, data: { participant, contact, consents: consentProjection(await ownConsentEvents(OPENID)) } }
    }

    if (event.action === 'participantDelete') {
      await removeOwnDocuments(consentEvents, OPENID)
      await removeOwnDocuments(participantRegistry, OPENID)
      await removeOwnDocuments(participantContacts, OPENID)
      return { ok: true, data: { deleted: true } }
    }

    if (event.action === 'assessmentSaveDraft') {
      const session = sanitizeAssessmentSession(event.session, OPENID)
      const existing = await findAssessmentSession(OPENID, session.assessmentId)
      if (existing && (Number(existing.clientUpdatedAt) > Number(session.clientUpdatedAt) || (Number(existing.clientUpdatedAt) === Number(session.clientUpdatedAt) && existing.status === 'report_generated'))) {
        return { ok: true, data: { session: existing, syncedAt: Date.now(), staleIgnored: true } }
      }
      if (existing && existing.activeReportId) session.activeReportId = existing.activeReportId
      if (existing && Number(existing.reportVersion)) session.reportVersion = Number(existing.reportVersion)
      session.status = 'synced'
      await assessmentSessions.doc(session._id).set({ data: session })
      return { ok: true, data: { session, syncedAt: Date.now() } }
    }

    if (event.action === 'assessmentComplete') {
      const session = sanitizeAssessmentSession(event.session, OPENID)
      if (ITEMS.some(item => !(item.id in session.answers))) reject('关系说明书还有未完成的题目', 'INVALID_ASSESSMENT')
      evaluateAssessment(session.answers)
      const previous = await findAssessmentSession(OPENID, session.assessmentId)
      if (previous && Number(previous.clientUpdatedAt) > Number(session.clientUpdatedAt)) reject('云端存在更新的回答，请刷新后再生成报告', 'ASSESSMENT_CONFLICT')
      if (previous && previous.status === 'report_generated' && previous.activeReportId && Number(previous.clientUpdatedAt) === Number(session.clientUpdatedAt)) {
        const existingReport = (await assessmentReports.doc(previous.activeReportId).get()).data
        return { ok: true, data: { session: previous, report: existingReport, syncedAt: Date.now(), duplicateIgnored: true } }
      }
      const reportVersion = previous && Number(previous.reportVersion) ? Number(previous.reportVersion) + 1 : 1
      const completedAt = Date.now()
      const qualitySession = Object.assign({}, session, { completedAt })
      const report = buildReport(session.answers, { generatedAt: completedAt, reportVersion, responseQuality: assessResponseQuality(qualitySession) })
      const reportId = `${session._id}_report_${reportVersion}`
      const reportDocument = Object.assign({ _id: reportId, _openid: OPENID, assessmentId: session.assessmentId, userConfirmations: {}, shareSettings: {} }, report)
      await assessmentReports.doc(reportId).set({ data: reportDocument })
      const completedSession = Object.assign({}, session, { status: 'report_generated', completedAt, updatedAt: completedAt, reportVersion, activeReportId: reportId })
      await assessmentSessions.doc(session._id).set({ data: completedSession })
      const legacyProfile = await findOwnProfile(OPENID)
      if (legacyProfile) {
        await profiles.doc(OPENID).update({ data: { exploration: dbCommand.remove(), questionnaireModules: dbCommand.remove(), recordFeedback: dbCommand.remove() } })
      }
      return { ok: true, data: { session: completedSession, report: reportDocument, syncedAt: completedAt } }
    }

    if (event.action === 'assessmentGet') {
      const assessmentId = text(event.assessmentId, 100)
      let session = assessmentId ? await findAssessmentSession(OPENID, assessmentId) : null
      if (!assessmentId && !session) {
        const candidates = await assessmentSessions.where({ _openid: OPENID }).limit(20).get()
        session = (candidates.data || []).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0] || null
      }
      if (!session) return { ok: true, data: { session: null, report: null } }
      let report = null
      if (session.activeReportId) {
        try { report = (await assessmentReports.doc(session.activeReportId).get()).data || null } catch (error) {
          if (!/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) throw error
        }
      }
      if (report) {
        try {
          const feedback = await assessmentFeedbackEvents.where({ _openid: OPENID, reportId: report._id }).limit(100).get()
          report.feedbackEvents = (feedback.data || []).sort((left, right) => Number(left.createdAt) - Number(right.createdAt))
          report.userConfirmations = confirmationProjectionFromEvents(report.feedbackEvents)
        } catch (error) {
          if (!/collection.*(does not exist|not exists?|not found)/i.test(error.errMsg || error.message || '')) throw error
        }
      }
      return { ok: true, data: { session, report } }
    }

    if (event.action === 'assessmentHistory') {
      const result = await assessmentReports.where({ _openid: OPENID }).limit(20).get()
      const reports = (result.data || []).sort((left, right) => Number(right.generatedAt) - Number(left.generatedAt)).map(report => ({
        _id: report._id,
        assessmentId: report.assessmentId,
        reportVersion: report.reportVersion,
        generatedAt: report.generatedAt,
        title: report.title,
        subtitle: report.subtitle,
        claims: report.claims || [],
        unknowns: report.unknowns || [],
        userConfirmations: report.userConfirmations || {}
      }))
      return { ok: true, data: { reports } }
    }

    if (event.action === 'assessmentFeedbackAppend') {
      const report = await findOwnReport(OPENID, text(event.reportId, 128))
      if (!report) reject('报告不存在或不属于当前用户', 'INVALID_FEEDBACK')
      const feedbackEvent = sanitizeFeedbackEvent(event.feedbackEvent, report, OPENID)
      let existing = null
      try { existing = (await assessmentFeedbackEvents.doc(feedbackEvent._id).get()).data || null } catch (error) {
        if (!/does not exist|not exists?|not found/i.test(error.errMsg || error.message || '')) throw error
      }
      if (existing) {
        if (!sameFeedbackEvent(existing, feedbackEvent)) reject('报告反馈编号已用于其他内容', 'FEEDBACK_CONFLICT')
        return { ok: true, data: { feedbackEvent: existing, duplicateIgnored: true, userConfirmations: report.userConfirmations || {} } }
      }
      await assessmentFeedbackEvents.doc(feedbackEvent._id).set({ data: feedbackEvent })
      const feedback = await assessmentFeedbackEvents.where({ _openid: OPENID, reportId: report._id }).limit(100).get()
      const userConfirmations = confirmationProjectionFromEvents(feedback.data || [])
      await assessmentReports.doc(report._id).update({ data: { userConfirmations } })
      return { ok: true, data: { feedbackEvent, userConfirmations } }
    }

    if (event.action === 'assessmentShareSettings') {
      const reportId = text(event.reportId, 128)
      const report = await findOwnReport(OPENID, reportId)
      if (!report) reject('报告不存在或不属于当前用户', 'INVALID_ASSESSMENT')
      const selectedClaimIds = Array.isArray(event.selectedClaimIds) ? [...new Set(event.selectedClaimIds.map(id => text(id, 80)))] : []
      if (selectedClaimIds.length > 4) reject('最多选择四条分享线索', 'INVALID_ASSESSMENT')
      const allowedIds = new Set((report.claims || []).filter(claim => claim.shareFragment && claim.section !== 'tension' && ['fits', 'partly_fits'].includes(report.userConfirmations && report.userConfirmations[claim.id] && report.userConfirmations[claim.id].value)).map(claim => claim.id))
      if (selectedClaimIds.some(id => !allowedIds.has(id))) reject('分享线索必须来自本人已核对的内容', 'INVALID_ASSESSMENT')
      const clientUpdatedAt = Number(event.clientUpdatedAt) || Date.now()
      if (report.shareSettings && Number(report.shareSettings.updatedAt) > clientUpdatedAt) return { ok: true, data: { shareSettings: report.shareSettings, staleIgnored: true } }
      const shareSettings = { selectedClaimIds, updatedAt: clientUpdatedAt }
      await assessmentReports.doc(reportId).update({ data: { shareSettings } })
      return { ok: true, data: { shareSettings } }
    }

    if (event.action === 'assessmentDelete') {
      await removeOwnDocuments(assessmentReports, OPENID)
      await removeOwnDocuments(assessmentSessions, OPENID)
      await removeOwnDocuments(assessmentFeedbackEvents, OPENID)
      const existing = await findOwnProfile(OPENID)
      if (existing) {
        await profiles.doc(OPENID).update({
          data: {
            status: 'paused',
            matching: Object.assign({}, existing.matching, { activeAssessmentReportId: '', reportVersion: 0 }),
            updatedAt: db.serverDate()
          }
        })
      }
      return { ok: true, data: { deleted: true, profilePaused: Boolean(existing) } }
    }

    if (event.action === 'deleteProfileOnly') {
      const existing = await findOwnProfile(OPENID)
      if (existing) await profiles.doc(OPENID).remove()
      return { ok: true, data: { deleted: true } }
    }

    if (event.action === 'delete') {
      const existing = await findOwnProfile(OPENID)
      if (existing) await profiles.doc(OPENID).remove()
      await removeOwnDocuments(assessmentReports, OPENID)
      await removeOwnDocuments(assessmentSessions, OPENID)
      await removeOwnDocuments(assessmentFeedbackEvents, OPENID)
      await removeOwnDocuments(consentEvents, OPENID)
      await removeOwnDocuments(participantRegistry, OPENID)
      await removeOwnDocuments(participantContacts, OPENID)
      return { ok: true, data: { deleted: true } }
    }

    return { ok: false, code: 'UNKNOWN_ACTION', message: '不支持的操作' }
  } catch (error) {
    console.error('datingProfile failed', { action: event.action, code: error.code, message: error.message })
    if (OPERATOR_ACTIONS.has(event.action)) {
      const targetId = text(event.caseId || event.participantId || event.action, 128)
      await appendAudit(OPENID, event.action, targetId, 'failure', { errorCode: error.code || 'SERVER_ERROR' }).catch(() => {})
    }
    return { ok: false, code: error.code || 'SERVER_ERROR', message: error.message || '云端处理失败' }
  }
}
