const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const engine = require('../shared/assessment-v3-p0/runtime-engine')
const store = require('../utils/assessment-v3-p0/session-store')
const archive = require('../utils/assessment-v3-p0/research-archive')

const context = {
  relationshipHistoryCategory: 'CURRENT_DATING',
  currentDatingStatus: 'NOT_DATING',
  responseContextForRelationshipItems: 'CURRENT_DATING'
}
const coding = {
  comprehension: 'correct',
  retrievalBasis: 'recent_real_event',
  responseMapping: 'easy',
  socialDesirability: 'none',
  emotionalSensitivity: 'low',
  constructContamination: { suspected: [] },
  recommendedAction: 'keep'
}

function start(participantStudyId, startedAt) {
  return store.startSession({ waveId: 'wave1', participantStudyId, relationshipContext: context, startedAt })
}

function allItemIds(session) {
  return session.assignment.assignedParentTaskIds.flatMap(parentTaskId => engine.expectedItemIdsForParent(parentTaskId))
}

function answerValue(itemId) {
  const format = engine.resolveFormat(engine.responseSpecForItem(itemId))
  if (format.type === 'single_select') return String((format.options || []).find(option => !option.missingCode).code)
  if (format.type === 'multi_select') {
    const options = (format.options || []).filter(option => !option.missingCode).map(option => String(option.code))
    const count = Math.max(1, Number(format.validation && format.validation.minSelections) || 1)
    return options.slice(0, count)
  }
  if (format.type === 'number') return Number(format.validation && format.validation.min !== undefined ? format.validation.min : 1)
  return 'A recent example.'
}

function accountAllExceptFirst(session) {
  const ids = allItemIds(session)
  store.answerItem(ids[0], answerValue(ids[0]))
  ids.slice(1).forEach(itemId => store.markMissing(itemId, 'USER_SKIPPED'))
  return ids
}

function accountAllMissing(session) {
  allItemIds(session).forEach(itemId => store.markMissing(itemId, 'USER_SKIPPED'))
  return allItemIds(session)
}

function codeItems(itemIds, except = null) {
  itemIds.filter(itemId => itemId !== except).forEach(itemId => store.saveItemCoding(itemId, coding))
}

function saveDebrief(session) {
  store.saveWaveDebrief({
    hardestItemIds: [allItemIds(session)[0]],
    repetitiveItemIds: [],
    correctAnswerFeelingItemId: allItemIds(session)[0],
    importantUnaskedNote: '',
    askedTooEarlyItemId: null,
    privacySensitiveItemId: null,
    privateInterviewNote: ''
  })
}

archive.clearArchive()
store.clearActiveSession()

// Missing responses are evidence, but still require interviewer coding.
let missingSession = start('P0-MISSING', 1700000000100)
const missingIds = accountAllMissing(missingSession)
saveDebrief(missingSession)
assert.throws(() => store.completeSession(), /CODING_REQUIRED/)
codeItems(missingIds, missingIds[0])
assert.throws(() => store.completeSession(), /CODING_REQUIRED/)
store.saveItemCoding(missingIds[0], coding)
const missingCompleted = store.completeSession()
archive.completeAndArchiveSession(missingCompleted)
assert.equal(store.getSession(), null)

// Participant A is archived, then participant B starts from a clean ledger.
const participantA = start('P0-A', 1700000000200)
const participantAIds = accountAllExceptFirst(participantA)
codeItems(participantAIds)
saveDebrief(participantA)
const completedA = store.completeSession()
const archiveA = archive.completeAndArchiveSession(completedA)
assert.equal(store.getSession(), null)
assert.equal(archive.appendCompletedSession(completedA).sessionId, archiveA.sessionId)
assert.equal(archive.listCompletedSessions().filter(entry => entry.sessionId === archiveA.sessionId).length, 1)

const participantB = start('P0-B', 1700000000300)
assert.notEqual(participantB.sessionId, archiveA.sessionId)
assert.deepEqual(participantB.latestAnswers, {})
assert.deepEqual(participantB.missingness, {})
assert.deepEqual(participantB.interviewerCodingByItem, {})
assert.deepEqual(participantB.answerEvents, [])
assert.deepEqual(participantB.taskEvents, [])
accountAllMissing(participantB)
const participantBIds = allItemIds(participantB)
codeItems(participantBIds)
saveDebrief(participantB)
const completedB = store.completeSession()
archive.completeAndArchiveSession(completedB)
assert.equal(store.getSession(), null)
const archived = archive.listCompletedSessions()
assert.equal(archived.length, 3)
assert.ok(archived.some(entry => entry.sessionId === archiveA.sessionId && entry.participantStudyId === 'P0-A'))
assert.ok(archived.some(entry => entry.sessionId === completedB.sessionId && entry.participantStudyId === 'P0-B'))

// An unfinished participant cannot be overwritten; continue or abandon is explicit.
const participantC = start('P0-C', 1700000000400)
store.markMissing(allItemIds(participantC)[0], 'USER_SKIPPED')
assert.throws(() => start('P0-D', 1700000000500), /P0_UNFINISHED_SESSION_EXISTS/)
assert.equal(store.continueSession().sessionId, participantC.sessionId)
store.abandonActiveSession()
const participantD = start('P0-D', 1700000000500)
assert.notEqual(participantD.sessionId, participantC.sessionId)
assert.deepEqual(participantD.latestAnswers, {})
assert.deepEqual(participantD.missingness, {})
assert.deepEqual(participantD.answerEvents, [])
store.clearActiveSession()

const participantPage = fs.readFileSync(path.join(__dirname, '..', 'pages/v3-p0-research/index.wxml'), 'utf8')
;['Continue', 'Back', 'Skip task', 'Finish responses', 'Answer each part'].forEach(text => {
  assert.equal(new RegExp(`>\\s*${text.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*<`).test(participantPage), false, `participant page still contains ${text}`)
})

console.log('V3 P0 final runtime lifecycle, missingness, and participant shell regressions OK')
