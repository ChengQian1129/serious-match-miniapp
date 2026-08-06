const { GOALS, SETTLEMENT_PLANS, CHILD_PLANS, RELATIONSHIP_AVAILABILITY, MARITAL_HISTORY, CHILDREN_STATUS, DISTANCE_ACCEPTANCE, SMOKING_STATUS, SMOKING_ACCEPTANCE } = require('../../utils/constants')
const { getProfile, saveSection, saveDraft, recordEvent } = require('../../utils/storage')
const { getStatusBarHeight } = require('../../utils/window')
const { acceptNavigationTap, getQuestionIndex, getMotionClass, showQuestion } = require('../../utils/question-flow')

const TOTAL_QUESTIONS = 19
const QUESTION_OFFSET = 4
const QUESTION_COUNT = 10
const STEP = 2

function ageFromBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 0
  const [year, month, day] = value.split('-').map(Number)
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1
  return age
}

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    goals: GOALS,
    settlementPlans: SETTLEMENT_PLANS,
    childPlans: CHILD_PLANS,
    availabilityOptions: RELATIONSHIP_AVAILABILITY,
    maritalHistoryOptions: MARITAL_HISTORY,
    childrenStatusOptions: CHILDREN_STATUS,
    distanceAcceptanceOptions: DISTANCE_ACCEPTANCE,
    smokingStatusOptions: SMOKING_STATUS,
    smokingAcceptanceOptions: SMOKING_ACCEPTANCE,
    ageOptions: [],
    minAgeIndex: 0,
    maxAgeIndex: 0,
    minAgePickerMounted: false,
    maxAgePickerMounted: false,
    minAgePickerVisible: false,
    maxAgePickerVisible: false,
    minAgePickerValue: [],
    maxAgePickerValue: [],
    currentQuestion: 0,
    questionNumber: 5,
    progress: 5 / TOTAL_QUESTIONS,
    canContinue: false,
    continueLabel: '继续',
    ageError: '',
    motionClass: '',
    form: {
      goal: '',
      settlementPlan: '',
      targetAgeMin: '',
      targetAgeMax: '',
      childPlan: '',
      availability: '',
      maritalHistory: '',
      childrenStatus: '',
      distanceAcceptance: '',
      smokingStatus: '',
      smokingAcceptance: ''
    },
    isEditing: false
  },

  onLoad(query) {
    const isEditing = query.edit === '1'
    const ageOptions = []
    for (let age = 18; age <= 70; age += 1) {
      ageOptions.push({ value: age, label: `${age} 岁` })
    }

    const profile = getProfile()
    const birthDate = profile.basic && profile.basic.birthDate
    const birthYear = Number(profile.basic && profile.basic.birthYear)
    const ownAge = ageFromBirthDate(birthDate) || (birthYear ? new Date().getFullYear() - birthYear : 30)
    const defaults = {
      targetAgeMin: Math.max(18, ownAge - 3),
      targetAgeMax: Math.min(70, ownAge + 5)
    }
    const form = Object.assign({}, this.data.form, defaults, profile.relationship || {})
    const required = [form.goal, form.settlementPlan, form.targetAgeMin && form.targetAgeMax, true, form.availability, form.maritalHistory, form.childrenStatus, form.distanceAcceptance, form.smokingStatus, form.smokingAcceptance]
    const firstMissing = required.findIndex(value => !value)
    const savedQuestion = profile.currentStep === STEP && Number.isInteger(profile.currentQuestion)
      ? profile.currentQuestion
      : firstMissing === -1 ? QUESTION_COUNT - 1 : firstMissing
    const fallbackQuestion = isEditing ? 0 : savedQuestion
    const currentQuestion = getQuestionIndex(query, fallbackQuestion, QUESTION_COUNT)
    this.setData(Object.assign({
      ageOptions,
      form,
      minAgeIndex: Math.max(0, ageOptions.findIndex(item => item.value === Number(form.targetAgeMin))),
      maxAgeIndex: Math.max(0, ageOptions.findIndex(item => item.value === Number(form.targetAgeMax))),
      minAgePickerValue: [Number(form.targetAgeMin)],
      maxAgePickerValue: [Number(form.targetAgeMax)],
      currentQuestion,
      motionClass: getMotionClass(query.direction),
      isEditing
    }, this.getQuestionState(currentQuestion, form, isEditing)))
  },

  onHide() {
    this.persistDraft()
  },

  onUnload() {
    this.persistDraft()
  },

  chooseGoal(event) {
    const value = event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.value : event.detail.value
    this.updateForm('goal', value)
  },

  chooseSettlement(event) {
    const value = event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.value : event.detail.value
    this.updateForm('settlementPlan', value)
  },

  chooseChildPlan(event) {
    const value = event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.value : event.detail.value
    this.updateForm('childPlan', value)
  },
  chooseAvailability(event) { this.updateForm('availability', event.currentTarget.dataset.value) },
  chooseMaritalHistory(event) { this.updateForm('maritalHistory', event.currentTarget.dataset.value) },
  chooseChildrenStatus(event) { this.updateForm('childrenStatus', event.currentTarget.dataset.value) },
  chooseDistanceAcceptance(event) { this.updateForm('distanceAcceptance', event.currentTarget.dataset.value) },
  chooseSmokingStatus(event) { this.updateForm('smokingStatus', event.currentTarget.dataset.value) },
  chooseSmokingAcceptance(event) { this.updateForm('smokingAcceptance', event.currentTarget.dataset.value) },

  changeMinAge(event) {
    const value = Number(event.detail.value[0])
    const index = this.data.ageOptions.findIndex(item => item.value === value)
    this.updateForm('targetAgeMin', value, { minAgeIndex: index, minAgePickerValue: [value], minAgePickerVisible: false })
  },

  changeMaxAge(event) {
    const value = Number(event.detail.value[0])
    const index = this.data.ageOptions.findIndex(item => item.value === value)
    this.updateForm('targetAgeMax', value, { maxAgeIndex: index, maxAgePickerValue: [value], maxAgePickerVisible: false })
  },

  openMinAgePicker() {
    if (this.data.minAgePickerMounted) {
      this.setData({ minAgePickerVisible: true })
      return
    }

    this.setData({ minAgePickerMounted: true }, () => {
      wx.nextTick(() => this.setData({ minAgePickerVisible: true }))
    })
  },

  closeMinAgePicker() {
    this.setData({ minAgePickerVisible: false })
  },

  openMaxAgePicker() {
    if (this.data.maxAgePickerMounted) {
      this.setData({ maxAgePickerVisible: true })
      return
    }

    this.setData({ maxAgePickerMounted: true }, () => {
      wx.nextTick(() => this.setData({ maxAgePickerVisible: true }))
    })
  },

  closeMaxAgePicker() {
    this.setData({ maxAgePickerVisible: false })
  },

  updateForm(key, value, extra) {
    const form = Object.assign({}, this.data.form, { [key]: value })
    const ageValid = Number(form.targetAgeMin) <= Number(form.targetAgeMax)
    this.setData(Object.assign({
      form,
      ageError: ageValid ? '' : '最小年龄不能大于最大年龄'
    }, this.getQuestionState(this.data.currentQuestion, form), extra || {}))
    this._draftDirty = true
  },

  getQuestionState(index, form, isEditing = this.data.isEditing) {
    const ageValid = Boolean(form.targetAgeMin && form.targetAgeMax && Number(form.targetAgeMin) <= Number(form.targetAgeMax))
    const valid = [Boolean(form.goal), Boolean(form.settlementPlan), ageValid, true, Boolean(form.availability), Boolean(form.maritalHistory), Boolean(form.childrenStatus), Boolean(form.distanceAcceptance), Boolean(form.smokingStatus), Boolean(form.smokingAcceptance)]
    return {
      questionNumber: QUESTION_OFFSET + index + 1,
      progress: (QUESTION_OFFSET + index + 1) / TOTAL_QUESTIONS,
      canContinue: valid[index],
      continueLabel: index === QUESTION_COUNT - 1
        ? (isEditing ? '保存关系期待' : '进入个人资料')
        : '继续'
    }
  },

  transitionTo(index, direction) {
    if (!showQuestion(this, index, QUESTION_COUNT, direction)) return
    this._draftDirty = true
  },

  persistDraft(step = STEP, question = this.data.currentQuestion) {
    if (this.data.isEditing || !this._draftDirty) return
    saveDraft('relationship', this.data.form, step, question)
    this._draftDirty = false
  },

  handlePrevious(event) {
    if (!acceptNavigationTap(this, event, 'back')) return
    if (this.data.currentQuestion === 0) {
      if (this._isRouting) return
      this._isRouting = true
      if (this.data.isEditing) {
        wx.navigateBack()
        return
      }
      this._draftDirty = true
      this.persistDraft(1, 3)
      wx.redirectTo({ url: '/pages/onboarding-basic/index?question=3&direction=back' })
      return
    }
    this.transitionTo(this.data.currentQuestion - 1, 'back')
  },

  handleContinue(event) {
    if (!acceptNavigationTap(this, event, 'continue')) return
    if (!this.data.canContinue) return
    if (this.data.currentQuestion < QUESTION_COUNT - 1) {
      this.transitionTo(this.data.currentQuestion + 1, 'forward')
      return
    }

    this.completeSection()
  },

  completeSection() {
    if (this._isRouting) return
    this._isRouting = true
    if (this.data.isEditing) {
      saveSection('relationship', this.data.form)
      recordEvent('relationship_updated')
      wx.reLaunch({ url: '/pages/profile/index', fail: () => { this._isRouting = false } })
      return
    }

    this._draftDirty = false
    saveSection('relationship', this.data.form, 3)
    recordEvent('relationship_step_complete')
    const suffix = this.data.isEditing ? '&edit=1' : ''
    wx.redirectTo({
      url: `/pages/onboarding-about/index?question=0${suffix}&direction=forward`,
      fail: () => { this._isRouting = false }
    })
  }
})
