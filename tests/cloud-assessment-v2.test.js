const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
const { ITEMS, INSTRUMENT_VERSION } = require('../utils/assessment-v2/questionnaire-definitions')
const { SCORING_RULE_VERSION } = require('../utils/assessment-v2/scoring-engine')
const { REPORT_RULE_VERSION } = require('../utils/assessment-v2/report-rules')

const collections = new Map()
const clone = value => JSON.parse(JSON.stringify(value))
const rows = name => { if (!collections.has(name)) collections.set(name, new Map()); return collections.get(name) }
const removeToken = { __remove: true }

function applyUpdate(target, data) {
  const next = Object.assign({}, target || {})
  Object.entries(data).forEach(([key, value]) => { if (value && value.__remove) delete next[key]; else next[key] = clone(value) })
  return next
}

let currentOpenid = 'v2-user'
const cloudStub = {
  DYNAMIC_CURRENT_ENV: 'test-env', init() {}, getWXContext() { return { OPENID: currentOpenid } },
  database() {
    return {
      command: { remove() { return removeToken } },
      serverDate() { return { $date: 'server' } },
      collection(name) {
        return {
          doc(id) {
            return {
              async get() { if (!rows(name).has(id)) throw new Error('document does not exist'); return { data: clone(rows(name).get(id)) } },
              async set({ data }) { rows(name).set(id, clone(data)) },
              async update({ data }) { rows(name).set(id, applyUpdate(rows(name).get(id), data)) },
              async remove() { rows(name).delete(id) }
            }
          },
          where(query) {
            const found = [...rows(name).values()].filter(row => Object.entries(query).every(([key, value]) => row[key] === value))
            return { limit() { return { async get() { return { data: clone(found) } } } } }
          }
        }
      }
    }
  }
}

const originalLoad = Module._load
Module._load = function load(request, parent, isMain) { if (request === 'wx-server-sdk') return cloudStub; return originalLoad.call(this, request, parent, isMain) }
const functionPath = path.resolve(__dirname, '../cloudfunctions/datingProfile/index.js')
delete require.cache[require.resolve(functionPath)]
const cloudFunction = require(functionPath)
Module._load = originalLoad

function session(updatedAt, answers) {
  return { assessmentId: 'relationship_manual_v2.test', assessmentType: 'relationship_manual_v2', instrumentVersion: INSTRUMENT_VERSION, scoringRuleVersion: SCORING_RULE_VERSION, reportRuleVersion: REPORT_RULE_VERSION, status: 'pending_cloud', currentChapterId: 'C1', currentItemIndex: 0, answers, answerEvents: [], completedChapters: [], itemOrder: ITEMS.map(item => item.id), startedAt: 10, updatedAt, completedAt: null }
}

async function run() {
  let result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: session(100, { RIN01: 5 }) })
  assert.equal(result.ok, true)
  result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: session(200, { RIN01: 5, RIN02: 5 }) })
  assert.equal(result.data.session.answers.RIN02, 5)
  result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: session(150, { RIN01: 1 }) })
  assert.equal(result.data.staleIgnored, true)
  assert.equal(result.data.session.answers.RIN02, 5)

  const chapterDraft = session(250, Object.fromEntries(ITEMS.slice(0, 8).map(item => [item.id, item.reverseScored ? 1 : 5])))
  chapterDraft.completedChapters = ['C1']
  chapterDraft.chapterFeedback = { C1: { value: 'partly_fits', note: '', reviewedAt: 240 } }
  result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: chapterDraft })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.chapterFeedback.C1.value, 'partly_fits')

  result = await cloudFunction.main({ action: 'assessmentGet', assessmentId: 'missing-id' })
  assert.equal(result.data.session, null)

  const answers = Object.fromEntries(ITEMS.map(item => [item.id, item.reverseScored ? 1 : 5]))
  result = await cloudFunction.main({ action: 'assessmentComplete', session: session(300, answers) })
  assert.equal(result.ok, true)
  assert.equal(result.data.report.reportVersion, 1)
  assert.ok(result.data.report.claims.length)

  result = await cloudFunction.main({ action: 'assessmentComplete', session: session(300, answers) })
  assert.equal(result.ok, true)
  assert.equal(result.data.duplicateIgnored, true)
  assert.equal(result.data.report.reportVersion, 1)
  const reportId = result.data.report._id
  const claimId = result.data.report.claims.find(claim => claim.shareFragment).id

  result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: session(300, answers) })
  assert.equal(result.ok, true)
  assert.equal(result.data.staleIgnored, true)
  assert.equal(result.data.session.status, 'report_generated')
  assert.ok(result.data.session.activeReportId)

  const revision = session(400, Object.assign({}, answers, { RIN01: 4 }))
  revision.revisionPending = true
  result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: revision })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.revisionPending, true)
  assert.ok(result.data.session.activeReportId)

  const firstFeedback = { eventId: 'feedback-1', reportId, claimId, value: 'partly_fits', note: '只在重要话题中如此', context: '', createdAt: 1000, supersedesFeedbackId: null }
  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: firstFeedback })
  assert.equal(result.ok, true)
  assert.equal(result.data.userConfirmations[claimId].value, 'partly_fits')
  const secondFeedback = { eventId: 'feedback-2', reportId, claimId, value: 'fits', note: '补充经历后更符合', context: '重要关系', createdAt: 1100, supersedesFeedbackId: 'feedback-1' }
  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: secondFeedback })
  assert.equal(result.ok, true)
  assert.equal(rows('assessment_feedback_events').size, 2)
  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: secondFeedback })
  assert.equal(result.data.duplicateIgnored, true)
  assert.equal(rows('assessment_feedback_events').size, 2)
  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: Object.assign({}, secondFeedback, { value: 'does_not_fit' }) })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'FEEDBACK_CONFLICT')
  const delayedFeedback = { eventId: 'feedback-delayed', reportId, claimId, value: 'does_not_fit', note: '离线设备上的较早反馈', context: '', createdAt: 1050, supersedesFeedbackId: 'feedback-1' }
  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: delayedFeedback })
  assert.equal(result.ok, true)
  assert.equal(result.data.userConfirmations[claimId].value, 'fits')
  assert.equal(rows('assessment_feedback_events').size, 3)

  result = await cloudFunction.main({ action: 'assessmentShareSettings', reportId, selectedClaimIds: [claimId], clientUpdatedAt: 1000 })
  assert.equal(result.ok, true)
  assert.deepEqual(result.data.shareSettings.selectedClaimIds, [claimId])
  result = await cloudFunction.main({ action: 'assessmentShareSettings', reportId, selectedClaimIds: [], clientUpdatedAt: 999 })
  assert.equal(result.data.staleIgnored, true)
  assert.deepEqual(result.data.shareSettings.selectedClaimIds, [claimId])
  result = await cloudFunction.main({ action: 'assessmentShareSettings', reportId, selectedClaimIds: ['not-confirmed'] })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'INVALID_ASSESSMENT')

  result = await cloudFunction.main({ action: 'assessmentGet', assessmentId: 'relationship_manual_v2.test' })
  assert.equal(result.ok, true)
  assert.equal(result.data.report.userConfirmations[claimId].value, 'fits')
  assert.equal(result.data.report.feedbackEvents.length, 3)

  result = await cloudFunction.main({ action: 'assessmentHistory' })
  assert.equal(result.ok, true)
  assert.equal(result.data.reports.length, 1)
  assert.equal(result.data.reports[0]._id, reportId)
  assert.equal('evaluation' in result.data.reports[0], false)

  for (const action of ['compareInviteCreate', 'compareInviteJoin', 'compareGet']) {
    result = await cloudFunction.main({ action, reportId })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'UNKNOWN_ACTION')
  }

  const participant = { displayName: '测试参与者', cityArea: '大连', availability: '工作日晚间', participationTypes: ['interview', 'research'] }
  const contact = { channel: 'wechat', value: 'test-contact', preferredTime: '周三晚' }
  rows('dating_profiles').set('v2-user', { _id: 'v2-user', _openid: 'v2-user', consent: { scope: 'matching_pool_v2', agreedAt: 1000 } })
  result = await cloudFunction.main({ action: 'consentList' })
  assert.deepEqual(result.data.consents, {})
  const consent = { eventId: 'consent-interview-1', scope: 'interview_contact', createdAt: 2000 }
  result = await cloudFunction.main({ action: 'consentGrant', consentEvent: consent })
  assert.equal(result.ok, true)
  result = await cloudFunction.main({ action: 'consentGrant', consentEvent: Object.assign({}, consent, { value: 'revoked' }) })
  assert.equal(result.data.duplicateIgnored, true)
  result = await cloudFunction.main({ action: 'participantUpsert', participant, contact })
  assert.equal(result.ok, true)
  result = await cloudFunction.main({ action: 'participantGet' })
  assert.equal(result.data.participant.displayName, '测试参与者')
  assert.equal(result.data.contact.value, 'test-contact')
  result = await cloudFunction.main({ action: 'consentGrant', consentEvent: { eventId: 'consent-research-1', scope: 'research_use', createdAt: 2010 } })
  assert.equal(result.ok, true)
  result = await cloudFunction.main({ action: 'consentRevoke', consentEvent: { eventId: 'consent-research-2', scope: 'research_use', createdAt: 2020 } })
  assert.equal(result.data.consents.research_use.value, 'revoked')
  result = await cloudFunction.main({ action: 'consentRevoke', consentEvent: { eventId: 'consent-interview-2', scope: 'interview_contact', createdAt: 2030 } })
  assert.equal(result.ok, true)
  result = await cloudFunction.main({ action: 'participantGet' })
  assert.equal(result.data.participant.status, 'withdrawn')
  result = await cloudFunction.main({ action: 'participantDelete' })
  assert.equal(result.ok, true)
  assert.equal([...rows('participant_registry').values()].some(item => item._openid === 'v2-user'), false)
  assert.equal([...rows('participant_contacts').values()].some(item => item._openid === 'v2-user'), false)
  assert.equal([...rows('consent_events').values()].some(item => item._openid === 'v2-user'), false)

  rows('dating_profiles').set('v2-user', { _id: 'v2-user', _openid: 'v2-user', status: 'active', matching: { activeAssessmentReportId: reportId, reportVersion: 1 } })
  result = await cloudFunction.main({ action: 'deleteProfileOnly' })
  assert.equal(result.ok, true)
  assert.equal(rows('dating_profiles').has('v2-user'), false)
  assert.equal([...rows('assessment_sessions').values()].some(item => item._openid === 'v2-user'), true)
  assert.equal([...rows('assessment_reports').values()].some(item => item._openid === 'v2-user'), true)

  rows('dating_profiles').set('v2-user', { _id: 'v2-user', _openid: 'v2-user', status: 'active', matching: { activeAssessmentReportId: reportId, reportVersion: 1 } })
  result = await cloudFunction.main({ action: 'assessmentDelete' })
  assert.equal(result.ok, true)
  assert.equal(rows('dating_profiles').get('v2-user').status, 'paused')
  assert.equal(rows('dating_profiles').get('v2-user').matching.activeAssessmentReportId, '')
  assert.equal([...rows('assessment_sessions').values()].some(item => item._openid === 'v2-user'), false)
  assert.equal([...rows('assessment_reports').values()].some(item => item._openid === 'v2-user'), false)
  assert.equal([...rows('assessment_feedback_events').values()].some(item => item._openid === 'v2-user'), false)

  result = await cloudFunction.main({ action: 'delete' })
  assert.equal(result.ok, true)
  result = await cloudFunction.main({ action: 'assessmentGet', assessmentId: 'relationship_manual_v2.test' })
  assert.equal(result.data.session, null)
  assert.equal(rows('assessment_reports').size, 0)
  console.log('Assessment V2 cloud OK: stale protection, report snapshot, restore, confirmation')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
