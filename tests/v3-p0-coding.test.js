const assert = require('node:assert/strict')
const storage = new Map()

global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const engine = require('../shared/assessment-v3-p0/runtime-engine')
const store = require('../utils/assessment-v3-p0/session-store')

store.startSession({
  waveId: 'wave1',
  participantStudyId: 'P0-002',
  relationshipContext: {
    relationshipHistoryCategory: 'PAST_RELATIONSHIP',
    currentDatingStatus: 'NOT_DATING',
    responseContextForRelationshipItems: 'PAST_RELATIONSHIP'
  }
})
store.answerItem('RR01', '4')

assert.throws(() => store.saveItemCoding('RR01', {
  comprehension: 'wrong',
  retrievalBasis: 'recent_real_event',
  responseMapping: 'easy',
  socialDesirability: 'none',
  emotionalSensitivity: 'low',
  constructContamination: { suspected: [] },
  recommendedAction: 'keep'
}), /INVALID_CODING:comprehension/)

const coding = {
  comprehension: 'partially_correct',
  retrievalBasis: 'recent_real_event',
  responseMapping: 'forced_between_options',
  socialDesirability: 'some',
  emotionalSensitivity: 'medium',
  constructContamination: { suspected: ['readiness', 'capacity'] },
  recommendedAction: 'rewrite'
}
store.saveItemCoding('RR01', coding, {
  interviewerNote: 'Participant gave a recent example.',
  missingOptionNote: 'Could use a time-bound option.',
  paraphraseNote: 'Stable meant predictable contact.'
})

let session = store.getSession()
assert.equal(session.interviewerCodingByItem.RR01.recommendedAction, 'rewrite')
assert.deepEqual(session.interviewerCodingByItem.RR01.constructContamination.suspected, ['readiness', 'capacity'])
assert.equal(session.itemProbeNotes.RR01.paraphraseNote, 'Stable meant predictable contact.')
assert.equal(session.taskEvents.some(event => event.eventType === 'CODING_SAVED'), true)

store.saveItemProbeNotes('RR01', { note: 'Follow-up note' })
session = store.getSession()
assert.equal(session.itemProbeNotes.RR01.interviewerNote, 'Follow-up note')
assert.equal(engine.getResearchTask('RR01').probeFocus.includes('readiness_vs_desire'), true)
assert.equal(engine.getPublicTask('RR01').probeFocus, undefined)

console.log('V3 P0 structured interviewer coding and probe notes OK')
