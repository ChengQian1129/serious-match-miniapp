const assert = require('node:assert/strict')
const storage = new Map()

global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const engine = require('../shared/assessment-v3-p0/runtime-engine')
const store = require('../utils/assessment-v3-p0/session-store')
const archive = require('../utils/assessment-v3-p0/research-archive')

archive.clearArchive()
store.startSession({
  waveId: 'wave2',
  participantStudyId: 'P0-003',
  relationshipContext: {
    relationshipHistoryCategory: 'CLOSE_NONROMANTIC_RELATIONSHIP',
    currentDatingStatus: 'NOT_DATING',
    responseContextForRelationshipItems: 'HYPOTHETICAL'
  },
  startedAt: 1700000000300
})

const active = store.getSession()
active.assignment.assignedParentTaskIds.forEach(parentTaskId => {
  engine.expectedItemIdsForParent(parentTaskId).forEach(itemId => store.markMissing(itemId, 'USER_SKIPPED'))
})
store.saveWaveDebrief({
  hardestItemIds: ['IDC-S01.a'],
  repetitiveItemIds: ['IDC03', 'IDC06'],
  correctAnswerFeelingItemId: 'IDC13',
  importantUnaskedNote: 'A question about timing would help.',
  askedTooEarlyItemId: 'IDC03',
  privacySensitiveItemId: 'IDC13',
  privateInterviewNote: 'Participant preferred a clearer purpose.'
})
const completed = store.completeSession()
assert.equal(completed.status, 'completed_no_scoring')

const entry = archive.appendCompletedSession(completed)
assert.equal(entry.waveId, 'wave2')
assert.equal(archive.listCompletedSessions().length, 1)
assert.equal(archive.listCompletedSessions({ waveId: 'wave2' }).length, 1)
assert.equal(archive.listCompletedSessions({ waveId: 'wave1' }).length, 0)
assert.throws(() => archive.appendCompletedSession(completed), /ARCHIVE_SESSION_EXISTS|PARTICIPANT_STUDY_ID_EXISTS/)

const firstExport = archive.exportArchiveJson()
const secondExport = archive.exportArchiveJson()
assert.equal(firstExport, secondExport)
const payload = JSON.parse(firstExport)
assert.equal(payload.exportSchemaVersion, archive.ARCHIVE_SCHEMA_VERSION)
assert.equal(payload.instrumentId, 'relationship_manual_v3_p0')
assert.equal(payload.scoring, 'NONE_IN_RUNTIME')
assert.equal(payload.sessions.length, 1)
assert.equal(Object.prototype.hasOwnProperty.call(payload.sessions[0], 'phone'), false)
assert.equal(Object.prototype.hasOwnProperty.call(payload.sessions[0], 'report'), false)

archive.deleteArchivedSession(completed.sessionId)
assert.equal(archive.listCompletedSessions().length, 0)
assert.throws(() => archive.deleteArchivedSession(completed.sessionId), /ARCHIVE_SESSION_NOT_FOUND/)

console.log('V3 P0 append-only archive and deterministic export OK')
