const assert = require('node:assert/strict')

const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const { ITEMS, CHAPTERS } = require('../utils/assessment-v2/questionnaire-definitions')
const store = require('../utils/assessment-v2/session-store')

assert.equal(store.hasSession(), false)
assert.equal(store.shouldSyncAssessment(), true)
store.setStorageChoice('local')
assert.equal(store.shouldSyncAssessment(), true)
store.setStorageChoice('cloud')
assert.equal(store.shouldSyncAssessment(), true)

CHAPTERS.forEach(chapter => {
  chapter.itemIds.forEach((itemId, index) => {
    const item = ITEMS.find(current => current.id === itemId)
    store.answerItem(itemId, item.reverseScored ? 1 : 5, { chapterId: chapter.id, itemIndex: index })
    store.setPosition(chapter.id, Math.min(index + 1, 7))
  })
  if (chapter.id !== 'C6') {
    store.completeChapter(chapter.id)
    if (chapter.id === 'C1') {
      const feedbackSession = store.saveChapterInsightFeedback('C1', 'partly_fits')
      assert.equal(feedbackSession.chapterFeedback.C1.value, 'partly_fits')
    }
  }
})

const beforeComplete = store.getSession()
assert.equal(beforeComplete.currentChapterId, 'C6')
assert.equal(Object.keys(beforeComplete.answers).length, 48)
const completed = store.completeAssessment()
assert.equal(completed.report.reportVersion, 1)
assert.ok(completed.report.responseQuality)
assert.equal(completed.session.completedChapters.length, 6)

const firstItem = ITEMS[0]
const eventCount = store.getSession().answerEvents.length
store.answerItem(firstItem.id, firstItem.reverseScored ? 1 : 5, { chapterId: 'C1', itemIndex: 0 })
assert.equal(store.getSession().answerEvents.length, eventCount)
store.answerItem(firstItem.id, 4, { chapterId: 'C1', itemIndex: 0 })
assert.equal(store.getSession().revisionPending, true)
const revised = store.completeAssessment()
assert.equal(revised.report.reportVersion, 2)
assert.equal(revised.session.revisionPending, false)

const claim = revised.report.claims[0]
const confirmed = store.saveClaimConfirmation(claim.id, 'partly_fits', '只在重要话题中如此')
assert.equal(confirmed.userConfirmations[claim.id].value, 'partly_fits')
assert.equal(confirmed.userConfirmations[claim.id].pendingCloud, true)

const cloudCopy = Object.assign({}, revised.report, { _id: 'report-2', userConfirmations: {} })
const merged = store.replaceReport(cloudCopy)
assert.equal(merged.userConfirmations[claim.id].value, 'partly_fits')
assert.equal(merged.userConfirmations[claim.id].pendingCloud, true)
const synced = store.markClaimConfirmationSynced(claim.id, { [claim.id]: { value: 'partly_fits', note: '', reviewedAt: Date.now() + 1 } })
assert.equal(synced.userConfirmations[claim.id].pendingCloud, false)

const nextVersion = store.replaceReport(Object.assign({}, cloudCopy, { reportVersion: 3, userConfirmations: {} }))
assert.deepEqual(nextVersion.userConfirmations, {})

console.log('Assessment V2 flow OK: resume, revision, confirmation, automatic cloud sync')
