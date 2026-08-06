const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const dbCommand = db.command
const profiles = db.collection('dating_profiles')
const assessmentSessions = db.collection('assessment_sessions')
const assessmentReports = db.collection('assessment_reports')
const assessmentInvites = db.collection('assessment_invites')
const { ASSESSMENT_ID, INSTRUMENT_VERSION, ITEMS } = require('./assessment-v2-questionnaire-definitions')
const { validateAnswers, evaluateAssessment } = require('./assessment-v2-scoring-engine')
const { buildReport } = require('./assessment-v2-report-engine')
const { assessResponseQuality } = require('./assessment-v2-quality-engine')
const PRIVACY_VERSION = 'cloud-1.0'

const allowed = {
  gender: new Set(['male', 'female', 'undisclosed']),
  targetGender: new Set(['male', 'female', 'all', 'undisclosed']),
  district: new Set(['high_tech_zone', 'ganjingzi', 'shahekou', 'xigang', 'zhongshan', 'jinpu', 'lvshunkou', 'other_dalian']),
  goal: new Set(['long_term', 'marriage', 'natural', 'open', 'unsure']),
  settlementPlan: new Set(['stay_dalian', 'may_leave', 'decide_together', 'unsure']),
  childPlan: new Set(['want', 'negotiable', 'unsure', 'no', 'skip', '']),
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

function compareReportSummaries(left, right) {
  const confirmed = report => (report.claims || []).filter(claim => claim.shareFragment && report.userConfirmations && ['fits', 'partly_fits'].includes(report.userConfirmations[claim.id] && report.userConfirmations[claim.id].value)).map(claim => claim.shareFragment)
  const leftShare = confirmed(left)
  const rightShare = confirmed(right)
  const leftDimensions = left.evaluation && left.evaluation.dimensions || {}
  const rightDimensions = right.evaluation && right.evaluation.dimensions || {}
  const aligned = []
  const discuss = []
  ;['response_predictability', 'emotional_support', 'autonomy_space', 'conflict_pause', 'repair_reengagement'].forEach(id => {
    const a = leftDimensions[id] || {}
    const b = rightDimensions[id] || {}
    if (a.provideState === 'provide_stable' && b.provideState === 'provide_stable') aligned.push(id)
    if (a.needState === 'need_clear' && b.provideState !== 'provide_stable' || b.needState === 'need_clear' && a.provideState !== 'provide_stable') discuss.push(id)
  })
  return { leftShare, rightShare, aligned, discuss, note: '这是双方当前自述的对照线索，不是匹配分数或成功率。' }
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
      birthDate,
      birthYear: Number(birthDate.slice(0, 4)),
      district: requireAllowed('district', basic.district, '所在区域')
    },
    relationship: {
      goal: requireAllowed('goal', relationship.goal, '关系目标'),
      settlementPlan: requireAllowed('settlementPlan', relationship.settlementPlan, '定居计划'),
      targetAgeMin,
      targetAgeMax,
      childPlan: requireAllowed('childPlan', relationship.childPlan || '', '孩子计划')
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

async function removeOwnCompareInvites(openid) {
  const groups = await Promise.all(['ownerOpenid', 'guestOpenid'].map(async field => {
    try { return (await assessmentInvites.where({ [field]: openid }).limit(100).get()).data || [] } catch (error) {
      if (/collection.*(does not exist|not exists?|not found)/i.test(error.errMsg || error.message || '')) return []
      throw error
    }
  }))
  const ids = [...new Set(groups.flat().map(invite => invite._id))]
  await Promise.all(ids.map(id => assessmentInvites.doc(id).remove()))
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_OPENID', message: '无法确认微信身份' }

  try {
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
      return { ok: true, data: { session, report } }
    }

    if (event.action === 'assessmentConfirmClaim') {
      const reportId = text(event.reportId, 128)
      const claimId = text(event.claimId, 80)
      const value = text(event.value, 24)
      if (!['fits', 'partly_fits', 'does_not_fit', 'unsure'].includes(value)) reject('报告核对选项无效', 'INVALID_ASSESSMENT')
      const result = await assessmentReports.doc(reportId).get()
      const report = result.data
      if (!report || report._openid !== OPENID || !(report.claims || []).some(claim => claim.id === claimId)) reject('报告结论不存在', 'INVALID_ASSESSMENT')
      const userConfirmations = Object.assign({}, report.userConfirmations, { [claimId]: { value, note: text(event.note, 200), reviewedAt: Date.now() } })
      await assessmentReports.doc(reportId).update({ data: { userConfirmations } })
      return { ok: true, data: { userConfirmations } }
    }

    if (event.action === 'compareInviteCreate') {
      const report = await findOwnReport(OPENID, text(event.reportId, 128))
      if (!report) reject('报告不存在或不属于当前用户', 'INVALID_ASSESSMENT')
      const code = crypto.randomBytes(5).toString('hex').toUpperCase()
      const createdAt = Date.now()
      const invite = { _id: code, _openid: OPENID, code, ownerOpenid: OPENID, ownerReportId: report._id, createdAt, expiresAt: createdAt + 7 * 24 * 60 * 60 * 1000, status: 'open' }
      await assessmentInvites.doc(code).set({ data: invite })
      return { ok: true, data: { code, expiresAt: invite.expiresAt } }
    }

    if (event.action === 'compareInviteJoin') {
      const code = text(event.code, 20).toUpperCase()
      const inviteResult = await assessmentInvites.doc(code).get()
      const invite = inviteResult.data
      if (!invite || invite.status !== 'open' || Number(invite.expiresAt) < Date.now()) reject('邀请已失效，请让对方重新生成', 'INVITE_EXPIRED')
      if (invite.ownerOpenid === OPENID) reject('不能用自己的邀请加入对照', 'INVALID_INVITE')
      const report = await findOwnReport(OPENID, text(event.reportId, 128))
      if (!report) reject('请先完成自己的关系说明书', 'INVALID_ASSESSMENT')
      const ownerReport = await findOwnReport(invite.ownerOpenid, invite.ownerReportId)
      if (!ownerReport) reject('邀请方报告已不可用', 'INVALID_INVITE')
      const joined = Object.assign({}, invite, { guestOpenid: OPENID, guestReportId: report._id, joinedAt: Date.now(), status: 'joined' })
      await assessmentInvites.doc(code).set({ data: joined })
      return { ok: true, data: { inviteId: code, comparison: compareReportSummaries(ownerReport, report) } }
    }

    if (event.action === 'compareGet') {
      const code = text(event.code, 20).toUpperCase()
      const inviteResult = await assessmentInvites.doc(code).get()
      const invite = inviteResult.data
      if (!invite || invite.status !== 'joined' || ![invite.ownerOpenid, invite.guestOpenid].includes(OPENID)) reject('对照邀请不存在或尚未完成', 'INVALID_INVITE')
      const ownerReport = await findOwnReport(invite.ownerOpenid, invite.ownerReportId)
      const guestReport = await findOwnReport(invite.guestOpenid, invite.guestReportId)
      if (!ownerReport || !guestReport) reject('对照报告暂时不可用', 'INVALID_INVITE')
      return { ok: true, data: { inviteId: code, comparison: compareReportSummaries(ownerReport, guestReport) } }
    }

    if (event.action === 'get') {
      const document = await findOwnProfile(OPENID)
      return {
        ok: true,
        data: {
          profile: toClientProfile(document),
          exploration: document && document.exploration ? document.exploration : null,
          recordFeedback: document && document.recordFeedback ? document.recordFeedback : null,
          questionnaireData: toClientQuestionnaireData(document)
        }
      }
    }

    if (event.action === 'saveExploration') {
      const exploration = sanitizeExploration(event.exploration)
      const existing = await findOwnProfile(OPENID)
      if (existing) {
        await profiles.doc(OPENID).update({
          data: { exploration, updatedAt: db.serverDate(), schemaVersion: 2 }
        })
      } else {
        await profiles.doc(OPENID).set({
          data: {
            exploration,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
            schemaVersion: 2
          }
        })
      }
      return { ok: true, data: { exploration, syncedAt: Date.now() } }
    }

    if (event.action === 'saveRecordFeedback') {
      const recordFeedback = sanitizeRecordFeedback(event.feedback)
      const existing = await findOwnProfile(OPENID)
      if (existing) {
        await profiles.doc(OPENID).update({
          data: { recordFeedback, updatedAt: db.serverDate(), schemaVersion: 3 }
        })
      } else {
        await profiles.doc(OPENID).set({
          data: {
            recordFeedback,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
            schemaVersion: 3
          }
        })
      }
      return { ok: true, data: { recordFeedback, syncedAt: Date.now() } }
    }

    if (event.action === 'saveQuestionnaireModule') {
      const existing = await findOwnProfile(OPENID)
      const moduleRecord = sanitizeQuestionnaireModule(event.moduleRecord)
      const existingModule = existing && existing.questionnaireModules && existing.questionnaireModules[moduleRecord.moduleId]
      assertQuestionnaireHistory(existingModule, moduleRecord)
      const questionnaireModules = Object.assign({}, existing && existing.questionnaireModules, {
        [moduleRecord.moduleId]: moduleRecord
      })
      if (existing) {
        await profiles.doc(OPENID).update({
          data: { questionnaireModules, updatedAt: db.serverDate(), schemaVersion: 4 }
        })
      } else {
        await profiles.doc(OPENID).set({
          data: {
            questionnaireModules,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
            schemaVersion: 4
          }
        })
      }
      return { ok: true, data: { moduleRecord, syncedAt: Date.now() } }
    }

    if (event.action === 'save') {
      const clean = sanitizeProfile(event.profile)
      const existing = await findOwnProfile(OPENID)
      const data = Object.assign({}, clean, {
        createdAt: existing && existing.createdAt ? existing.createdAt : db.serverDate(),
        updatedAt: db.serverDate(),
        schemaVersion: 3
      })
      if (!data.exploration && existing && existing.exploration) data.exploration = existing.exploration
      if (existing && existing.recordFeedback) data.recordFeedback = existing.recordFeedback
      if (existing && existing.questionnaireModules) data.questionnaireModules = existing.questionnaireModules
      await profiles.doc(OPENID).set({
        data
      })
      return { ok: true, data: { profile: toClientProfile(clean), syncedAt: Date.now() } }
    }

    if (event.action === 'setStatus') {
      if (!['active', 'paused'].includes(event.status)) reject('资料状态无效')
      const existing = await findOwnProfile(OPENID)
      if (!existing) reject('云端资料不存在', 'PROFILE_NOT_FOUND')
      const clientUpdatedAt = Number(event.clientUpdatedAt) || Date.now()
      await profiles.doc(OPENID).update({
        data: { status: event.status, clientUpdatedAt, updatedAt: db.serverDate() }
      })
      return { ok: true, data: { status: event.status, clientUpdatedAt } }
    }

    if (event.action === 'delete') {
      const existing = await findOwnProfile(OPENID)
      if (existing) await profiles.doc(OPENID).remove()
      await removeOwnDocuments(assessmentReports, OPENID)
      await removeOwnDocuments(assessmentSessions, OPENID)
      await removeOwnCompareInvites(OPENID)
      return { ok: true, data: { deleted: true } }
    }

    return { ok: false, code: 'UNKNOWN_ACTION', message: '不支持的操作' }
  } catch (error) {
    console.error('datingProfile failed', { action: event.action, code: error.code, message: error.message })
    return { ok: false, code: error.code || 'SERVER_ERROR', message: error.message || '云端处理失败' }
  }
}
