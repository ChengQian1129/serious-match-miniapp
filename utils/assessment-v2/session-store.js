const { ASSESSMENT_ID, INSTRUMENT_VERSION, ITEMS, CHAPTERS, getChapter, getItem, optionsFor } = require('./questionnaire-definitions')
const { SCORING_RULE_VERSION } = require('./scoring-engine')
const { REPORT_RULE_VERSION } = require('./report-rules')
const { buildReport } = require('./report-engine')
const { assessResponseQuality } = require('./quality-engine')

const SESSION_KEY = 'serious_match_assessment_v2'
const REPORT_KEY = 'serious_match_report_v2'
const STORAGE_CHOICE_KEY = 'serious_match_assessment_storage_choice_v2'

function emptySession(now = Date.now()) {
  return {
    assessmentId: `${ASSESSMENT_ID}.${now}`,
    assessmentType: ASSESSMENT_ID,
    instrumentVersion: INSTRUMENT_VERSION,
    scoringRuleVersion: SCORING_RULE_VERSION,
    reportRuleVersion: REPORT_RULE_VERSION,
    status: 'draft_local',
    currentChapterId: 'C1',
    currentItemIndex: 0,
    answers: {},
    answerEvents: [],
    itemOrder: ITEMS.map(item => item.id),
    completedChapters: [],
    chapterFeedback: {},
    startedAt: now,
    updatedAt: now,
    completedAt: null
  }
}

function validSession(value) {
  return value && value.assessmentType === ASSESSMENT_ID && value.instrumentVersion === INSTRUMENT_VERSION && value.answers
}

function getSession() {
  const stored = wx.getStorageSync(SESSION_KEY)
  return validSession(stored) ? stored : emptySession()
}

function hasSession() {
  return Boolean(validSession(wx.getStorageSync(SESSION_KEY)))
}

function saveSession(session) {
  wx.setStorageSync(SESSION_KEY, session)
  return session
}

function setPosition(chapterId, itemIndex) {
  const session = getSession()
  return saveSession(Object.assign({}, session, { currentChapterId: chapterId, currentItemIndex: itemIndex, updatedAt: Date.now() }))
}

function answerItem(itemId, rawValue, position) {
  const item = getItem(itemId)
  if (!item || !optionsFor(item).some(option => option.value === rawValue)) throw new Error(`回答 ${itemId} 无效`)
  const session = getSession()
  if (session.answers[itemId] === rawValue) return session
  const now = Date.now()
  const previous = [...session.answerEvents].reverse().find(event => event.itemId === itemId)
  const event = {
    eventId: `${itemId}.${now}.${session.answerEvents.length + 1}`,
    itemId,
    rawValue,
    answeredAt: now,
    supersedesEventId: previous ? previous.eventId : null
  }
  return saveSession(Object.assign({}, session, {
    status: 'pending_cloud',
    revisionPending: Boolean(session.completedAt || session.revisionPending),
    currentChapterId: position.chapterId,
    currentItemIndex: position.itemIndex,
    answers: Object.assign({}, session.answers, { [itemId]: rawValue }),
    answerEvents: session.answerEvents.concat(event),
    updatedAt: now
  }))
}

function completeChapter(chapterId) {
  const chapter = getChapter(chapterId)
  const session = getSession()
  if (!chapter || chapter.itemIds.some(id => !(id in session.answers))) throw new Error('这一章还有未作答或未跳过的题目')
  const index = CHAPTERS.findIndex(item => item.id === chapterId)
  const nextChapter = CHAPTERS[index + 1]
  return saveSession(Object.assign({}, session, {
    status: 'pending_cloud',
    currentChapterId: nextChapter ? nextChapter.id : chapterId,
    currentItemIndex: 0,
    completedChapters: [...new Set(session.completedChapters.concat(chapterId))],
    updatedAt: Date.now()
  }))
}

function completeAssessment() {
  const session = getSession()
  if (ITEMS.some(item => !(item.id in session.answers))) throw new Error('关系说明书还有未完成的题目')
  const completedAt = Date.now()
  const previousReport = getReport()
  const reportVersion = previousReport && Number(previousReport.reportVersion) ? Number(previousReport.reportVersion) + 1 : 1
  const completed = saveSession(Object.assign({}, session, { status: 'report_generated', revisionPending: false, completedChapters: CHAPTERS.map(chapter => chapter.id), completedAt, updatedAt: completedAt }))
  const report = buildReport(completed.answers, { generatedAt: completedAt, reportVersion, responseQuality: assessResponseQuality(completed) })
  wx.setStorageSync(REPORT_KEY, report)
  return { session: completed, report }
}

function getReport() { return wx.getStorageSync(REPORT_KEY) || null }
function saveChapterInsightFeedback(chapterId, value, note = '') {
  if (!/^C[1-6]$/.test(chapterId) || !['fits', 'partly_fits', 'does_not_fit', 'unsure'].includes(value)) throw new Error('阶段发现核对选项无效')
  const session = getSession()
  if (!session.completedChapters.includes(chapterId)) throw new Error('这一章还没有完成')
  const chapterFeedback = Object.assign({}, session.chapterFeedback, {
    [chapterId]: { value, note: String(note || '').slice(0, 200), reviewedAt: Date.now() }
  })
  return saveSession(Object.assign({}, session, { chapterFeedback, status: 'pending_cloud', updatedAt: Date.now() }))
}
function getStorageChoice() { return wx.getStorageSync(STORAGE_CHOICE_KEY) || null }
function setStorageChoice(choice) {
  if (!['cloud', 'local'].includes(choice)) throw new Error('保存方式无效')
  const value = { choice, decidedAt: Date.now() }
  wx.setStorageSync(STORAGE_CHOICE_KEY, value)
  return value
}
function shouldSyncAssessment() { const choice = getStorageChoice(); return Boolean(choice && choice.choice === 'cloud') }
function saveClaimConfirmation(claimId, value, note = '') {
  const report = getReport()
  if (!report || !report.claims.some(claim => claim.id === claimId)) throw new Error('报告结论不存在')
  const confirmations = Object.assign({}, report.userConfirmations, {
    [claimId]: { value, note: String(note || '').slice(0, 200), reviewedAt: Date.now(), pendingCloud: shouldSyncAssessment() }
  })
  const next = Object.assign({}, report, { userConfirmations: confirmations })
  wx.setStorageSync(REPORT_KEY, next)
  return next
}
function replaceSession(session) { if (!validSession(session)) throw new Error('云端作答记录无效'); return saveSession(session) }
function replaceReport(report) {
  if (!report || report.instrumentVersion !== INSTRUMENT_VERSION) throw new Error('云端报告版本无效')
  const local = getReport()
  const mergedConfirmations = Object.assign({}, report.userConfirmations)
  if (local && Number(local.reportVersion) === Number(report.reportVersion)) {
    Object.entries(local.userConfirmations || {}).forEach(([claimId, confirmation]) => {
      const incoming = mergedConfirmations[claimId]
      if (!incoming || Number(confirmation.reviewedAt) > Number(incoming.reviewedAt)) mergedConfirmations[claimId] = confirmation
    })
  }
  const next = Object.assign({}, report, { userConfirmations: mergedConfirmations })
  wx.setStorageSync(REPORT_KEY, next)
  return next
}
function markClaimConfirmationSynced(claimId, cloudConfirmations) {
  const report = getReport()
  if (!report) return null
  const local = report.userConfirmations && report.userConfirmations[claimId]
  if (!local) return report
  const cloud = cloudConfirmations && cloudConfirmations[claimId]
  const confirmation = cloud && Number(cloud.reviewedAt) >= Number(local.reviewedAt)
    ? cloud
    : Object.assign({}, local, { pendingCloud: false })
  const next = Object.assign({}, report, { userConfirmations: Object.assign({}, report.userConfirmations, { [claimId]: confirmation }) })
  wx.setStorageSync(REPORT_KEY, next)
  return next
}
function markSynced(syncedAt = Date.now()) { const session = getSession(); return saveSession(Object.assign({}, session, { status: session.completedAt ? 'report_generated' : 'synced', syncedAt })) }
function resetAssessment() { wx.removeStorageSync(SESSION_KEY); wx.removeStorageSync(REPORT_KEY) }

module.exports = { SESSION_KEY, REPORT_KEY, STORAGE_CHOICE_KEY, emptySession, getSession, hasSession, setPosition, answerItem, completeChapter, completeAssessment, getReport, saveChapterInsightFeedback, getStorageChoice, setStorageChoice, shouldSyncAssessment, saveClaimConfirmation, markClaimConfirmationSynced, replaceSession, replaceReport, markSynced, resetAssessment }
