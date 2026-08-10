const assert = require('node:assert/strict')
const storage = new Map()

global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const engine = require('../shared/assessment-v3-p0/runtime-engine')
const store = require('../utils/assessment-v3-p0/session-store')

store.resetSession()
assert.throws(() => store.startSession({ waveId: 'wave1', participantStudyId: 'bad id', relationshipContext: {} }), /INVALID_PARTICIPANT_STUDY_ID/)
assert.throws(() => store.startSession({ waveId: 'wave1', participantStudyId: 'P0-001', relationshipContext: {} }), /INVALID_RELATIONSHIP_CONTEXT/)

let session = store.startSession({
  waveId: 'wave1',
  participantStudyId: 'P0-001',
  relationshipContext: {
    relationshipHistoryCategory: 'CURRENT_DATING',
    currentDatingStatus: 'NOT_DATING',
    responseContextForRelationshipItems: 'CURRENT_DATING'
  },
  startedAt: 1700000000000
})
assert.equal(session.waveId, 'wave1')
assert.equal(session.assignment.assignedParentTaskIds.length, 20)
assert.equal(Object.prototype.hasOwnProperty.call(session, 'phone'), false)
assert.equal(Object.prototype.hasOwnProperty.call(session, 'name'), false)

store.recordTaskShown('RR01')
store.answerItem('RR01', '4')
store.answerItem('RR01', '5')
session = store.getSession()
assert.equal(session.latestAnswers.RR01, '5')
assert.equal(session.answerEvents.length, 2)
assert.equal(session.answerEvents[1].responseStage, 'silent_first')
assert.equal(session.answerEvents[1].contextBasis, 'CURRENT_DATING')
assert.equal(typeof session.answerEvents[1].responseTimeMs, 'number')
assert.equal(session.answerEvents[1].supersedesEventId, session.answerEvents[0].eventId)
assert.equal(session.taskEvents.some(event => event.eventType === 'SHOWN'), true)
const tampered = store.getSession()
tampered.answerEvents.shift()
assert.throws(() => store.saveSession(tampered), /ANSWER_EVENTS_APPEND_ONLY/)

const compoundIndex = session.assignment.assignedParentTaskIds.indexOf('UA-S01')
store.setTaskIndex(compoundIndex)
store.answerItem('UA-S01.a', '3')
assert.equal(store.getProgress().completedParents >= 1, true)
assert.equal(store.getSession().latestAnswers['UA-S01.a'], '3')
assert.throws(() => store.goNext(), /CURRENT_TASK_INCOMPLETE/)
store.answerItem('UA-S01.b', '2')
store.answerItem('UA-S01.c', '4')
assert.doesNotThrow(() => store.goNext())

const after = store.getSession()
assert.equal(after.currentTaskIndex, compoundIndex + 1)
assert.equal(engine.isParentComplete('UA-S01', after.latestAnswers, after.missingness), true)

store.markMissing('UA01', 'USER_SKIPPED')
assert.equal(store.getSession().missingness.UA01.code, 'USER_SKIPPED')
assert.throws(() => store.markMissing('UA01', 'NOT_A_CODE'), /INVALID_MISSINGNESS_CODE/)

console.log('V3 P0 session model and immutable answer events OK')
