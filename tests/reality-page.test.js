const assert = require('node:assert/strict')

const storage = new Map()
let redirectedTo = ''
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync(key) { storage.delete(key) },
  getWindowInfo() { return { statusBarHeight: 20 } },
  pageScrollTo() {},
  nextTick(callback) { callback() },
  redirectTo(options) { redirectedTo = options.url },
  navigateBack() {},
  reLaunch() {}
}

storage.set('serious_match_profile_v1', { status: 'draft', currentStep: 3, currentQuestion: 0, basic: {}, relationship: {}, reality: {}, about: {}, contact: {}, consent: {}, createdAt: 1, updatedAt: 1 })

let definition
global.Page = value => { definition = value }
require('../pages/onboarding-reality/index.js')

function createPage() {
  return Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values, callback) { Object.assign(this.data, values); if (callback) callback() }
  })
}

let page = createPage()
page.onLoad({ question: '0' })
page.toggleMeetingTime({ currentTarget: { dataset: { value: 'weekend_daytime' } } })
page.toggleMeetingTime({ currentTarget: { dataset: { value: 'weekday_evening' } } })
assert.deepEqual(page.data.form.meetingTimes, ['weekend_daytime', 'weekday_evening'])
page.handleContinue({ timeStamp: 1000 })
page.chooseOption({ currentTarget: { dataset: { field: 'commuteTolerance', value: 'within_60m' } } })
page.onHide()

page = createPage()
page.onLoad({})
assert.equal(page.data.currentQuestion, 1)
assert.equal(page.data.form.commuteTolerance, 'within_60m')
assert.equal(page.data.meetingTimeOptions.find(item => item.value === 'weekend_daytime').selected, true)

const answers = [
  ['commuteTolerance', 'within_60m'], ['schedulePattern', 'regular'], ['marriageTimeline', 'one_two_years'],
  ['parentCohabitation', 'separate'], ['financeStyle', 'shared_budget'], ['houseworkStyle', 'by_strength'],
  ['petAcceptance', 'accept'], ['alcoholAcceptance', 'social'], ['socialRhythm', 'balanced']
]
answers.forEach(([field, value], index) => {
  assert.equal(page.data.currentQuestion, index + 1)
  page.chooseOption({ currentTarget: { dataset: { field, value } } })
  page.handleContinue({ timeStamp: 2000 + index * 500 })
})

assert.equal(redirectedTo, '/pages/onboarding-about/index?question=0&direction=forward')
const saved = storage.get('serious_match_profile_v1')
assert.equal(saved.currentStep, 4)
assert.equal(saved.reality.socialRhythm, 'balanced')
assert.deepEqual(saved.reality.meetingTimes, ['weekend_daytime', 'weekday_evening'])
console.log('Reality page OK: multi-select, resume, navigation, and draft persistence')
