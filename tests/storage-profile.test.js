const assert = require('node:assert/strict')

const storage = new Map()
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) }
}

const profileStore = require('../utils/storage')
const assessmentStore = require('../utils/assessment-v2/session-store')
assert.equal(profileStore.hasProfile(), false)
profileStore.saveDraft('basic', { gender: 'male' }, 1, 1)
assert.equal(profileStore.hasProfile(), false)
const completed = profileStore.completeProfile({ type: 'phone', phone: '13800138000' }, { agreedAt: Date.now() })
assert.equal(completed.status, 'active')
assert.equal(profileStore.hasProfile(), true)
profileStore.setStatus('paused')
assert.equal(profileStore.hasProfile(), true)

storage.set('serious_match_assessment_v2', { assessmentType: 'relationship_manual_v2' })
storage.set('serious_match_report_v2', { reportVersion: 1 })
storage.set('serious_match_assessment_storage_choice_v2', { choice: 'cloud' })
profileStore.deleteMatchingProfile()
assert.equal(profileStore.hasProfile(), false)
assert.ok(storage.has('serious_match_assessment_v2'))
assert.ok(storage.has('serious_match_report_v2'))
assert.ok(storage.has('serious_match_assessment_storage_choice_v2'))

profileStore.completeProfile({ type: 'phone', phone: '13800138000' }, { agreedAt: Date.now() })
assessmentStore.resetAssessment()
assert.equal(profileStore.hasProfile(), true)
assert.equal(storage.has('serious_match_assessment_v2'), false)
assert.equal(storage.has('serious_match_report_v2'), false)
assert.equal(storage.has('serious_match_assessment_storage_choice_v2'), false)

profileStore.clearAssessmentFromProfile()
assert.equal(profileStore.getProfile().status, 'paused')
assert.equal(profileStore.getProfile().matching.activeAssessmentReportId, '')
assert.equal(profileStore.getProfile().matching.reportVersion, 0)

profileStore.deleteProfile()
assert.equal(profileStore.hasProfile(), false)
assert.equal(storage.has('serious_match_assessment_v2'), false)
assert.equal(storage.has('serious_match_report_v2'), false)
assert.equal(storage.has('serious_match_assessment_storage_choice_v2'), false)

console.log('Profile storage OK: profile, assessment, and full deletion stay independent')
