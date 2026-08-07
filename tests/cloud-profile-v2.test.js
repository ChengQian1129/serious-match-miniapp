const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')

const collections = new Map()
const clone = value => JSON.parse(JSON.stringify(value))
const rows = name => { if (!collections.has(name)) collections.set(name, new Map()); return collections.get(name) }
const removeToken = { __remove: true }
function applyUpdate(target, data) {
  const next = Object.assign({}, target || {})
  Object.entries(data).forEach(([key, value]) => { if (value && value.__remove) delete next[key]; else next[key] = clone(value) })
  return next
}

const cloudStub = {
  DYNAMIC_CURRENT_ENV: 'test-env', init() {}, getWXContext() { return { OPENID: 'profile-user' } },
  database() {
    return {
      command: { remove() { return removeToken } }, serverDate() { return { $date: 'server' } },
      collection(name) {
        return {
          doc(id) { return { async get() { if (!rows(name).has(id)) throw new Error('document does not exist'); return { data: clone(rows(name).get(id)) } }, async set({ data }) { rows(name).set(id, clone(data)) }, async update({ data }) { rows(name).set(id, applyUpdate(rows(name).get(id), data)) }, async remove() { rows(name).delete(id) } } },
          where(query) { const found = [...rows(name).values()].filter(row => Object.entries(query).every(([key, value]) => row[key] === value)); return { limit() { return { async get() { return { data: clone(found) } } } } } }
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

function profile() {
  return {
    status: 'active', createdAt: 1, updatedAt: 2,
    basic: { gender: 'male', targetGender: 'female', targetGenderPriority: 'must', birthDate: '1992-05-20', district: 'shahekou' },
    relationship: { goal: 'marriage', settlementPlan: 'stay_dalian', targetAgeMin: 26, targetAgeMax: 38, agePriority: 'must', childPlan: 'want', childPlanPriority: 'important', availability: 'single_ready', maritalHistory: 'never_married', childrenStatus: 'none', distanceAcceptance: 'dalian_only', distancePriority: 'important', smokingStatus: 'never', smokingAcceptance: 'never', smokingPriority: 'must' },
    reality: { meetingTimes: ['weekday_evening', 'weekend_daytime'], commuteTolerance: 'within_60m', schedulePattern: 'regular', marriageTimeline: 'one_two_years', parentCohabitation: 'separate', financeStyle: 'shared_budget', houseworkStyle: 'by_strength', petAcceptance: 'accept', alcoholAcceptance: 'social', socialRhythm: 'balanced' },
    about: { displayName: '测试用户', heightCm: 178, workStatus: 'full_time', industry: 'internet', occupation: '产品经理' },
    contact: { type: 'phone', phone: '13800138000' }, consent: { version: 'cloud-1.0', agreedAt: 10 }, matching: { matchingPoolConsentAt: 10, activeAssessmentReportId: 'report-1', reportVersion: 1 }
  }
}

async function run() {
  let result = await cloudFunction.main({ action: 'save', profile: profile() })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'UNKNOWN_ACTION')
  result = await cloudFunction.main({ action: 'setStatus', status: 'paused', clientUpdatedAt: 20 })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'UNKNOWN_ACTION')

  rows('dating_profiles').set('profile-user', Object.assign({ _id: 'profile-user', _openid: 'profile-user' }, profile()))
  result = await cloudFunction.main({ action: 'deleteProfileOnly' })
  assert.equal(result.ok, true)
  assert.equal(rows('dating_profiles').has('profile-user'), false)
  console.log('Legacy profile boundary OK: new writes are closed, deletion remains available')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
