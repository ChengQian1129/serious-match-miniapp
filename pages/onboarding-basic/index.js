const { GENDERS, TARGET_GENDERS, DISTRICTS } = require('../../utils/constants')
const { getProfile, saveSection, saveDraft, recordEvent } = require('../../utils/storage')
const { labelOf } = require('../../utils/formatters')
const { getStatusBarHeight } = require('../../utils/window')
const { acceptNavigationTap, getQuestionIndex, getMotionClass, showQuestion } = require('../../utils/question-flow')

const TOTAL_QUESTIONS = 13
const QUESTION_COUNT = 4
const STEP = 1

function dateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function yearsAgo(today, years) {
  const year = today.getFullYear() - years
  const month = today.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(today.getDate(), lastDay))
}

function birthDateLabel(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`
}

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    genders: GENDERS,
    targetGenders: TARGET_GENDERS,
    districts: DISTRICTS,
    minBirthDate: '',
    maxBirthDate: '',
    birthDateLabel: '',
    districtIndex: 0,
    districtLabel: '',
    currentQuestion: 0,
    questionNumber: 1,
    progress: 1 / TOTAL_QUESTIONS,
    canContinue: false,
    continueLabel: '继续',
    motionClass: '',
    form: {
      gender: '',
      targetGender: '',
      birthDate: '',
      birthYear: '',
      district: ''
    },
    isEditing: false
  },

  onLoad(query) {
    const isEditing = query.edit === '1'
    const today = new Date()
    const minBirthDate = dateValue(yearsAgo(today, 70))
    const maxBirthDate = dateValue(yearsAgo(today, 18))

    const profile = getProfile()
    const form = Object.assign({}, this.data.form, profile.basic || {})
    const required = [form.gender, form.targetGender, form.birthDate, form.district]
    const firstMissing = required.findIndex(value => !value)
    const savedQuestion = profile.currentStep === STEP && Number.isInteger(profile.currentQuestion)
      ? profile.currentQuestion
      : firstMissing === -1 ? QUESTION_COUNT - 1 : firstMissing
    const fallbackQuestion = isEditing ? 0 : savedQuestion
    const currentQuestion = getQuestionIndex(query, fallbackQuestion, QUESTION_COUNT)
    this.setData(Object.assign({
      form,
      minBirthDate,
      maxBirthDate,
      birthDateLabel: birthDateLabel(form.birthDate),
      districtIndex: Math.max(0, DISTRICTS.findIndex(item => item.value === form.district)),
      districtLabel: labelOf(DISTRICTS, form.district),
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

  chooseGender(event) {
    const value = event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.value : event.detail.value
    this.updateForm('gender', value)
  },

  chooseTargetGender(event) {
    const value = event.currentTarget && event.currentTarget.dataset ? event.currentTarget.dataset.value : event.detail.value
    this.updateForm('targetGender', value)
  },

  changeDistrict(event) {
    const index = Number(event.detail.value)
    const district = this.data.districts[index]
    if (!district) return
    this.updateForm('district', district.value, {
      districtIndex: index,
      districtLabel: district.label
    })
  },

  changeBirthDate(event) {
    const birthDate = event.detail.value
    const birthYear = Number(birthDate.slice(0, 4))
    const form = Object.assign({}, this.data.form, { birthDate, birthYear })
    this.setData(Object.assign({
      form,
      birthDateLabel: birthDateLabel(birthDate)
    }, this.getQuestionState(this.data.currentQuestion, form)))
    this._draftDirty = true
  },

  updateForm(key, value, extra) {
    const form = Object.assign({}, this.data.form, { [key]: value })
    this.setData(Object.assign({ form }, this.getQuestionState(this.data.currentQuestion, form), extra || {}))
    this._draftDirty = true
  },

  getQuestionState(index, form, isEditing = this.data.isEditing) {
    const values = [form.gender, form.targetGender, form.birthDate, form.district]
    return {
      questionNumber: index + 1,
      progress: (index + 1) / TOTAL_QUESTIONS,
      canContinue: Boolean(values[index]),
      continueLabel: index === QUESTION_COUNT - 1
        ? (isEditing ? '保存基本资料' : '进入关系期待')
        : '继续'
    }
  },

  transitionTo(index, direction) {
    if (!showQuestion(this, index, QUESTION_COUNT, direction)) return
    this._draftDirty = true
  },

  persistDraft(step = STEP, question = this.data.currentQuestion) {
    if (this.data.isEditing || !this._draftDirty) return
    saveDraft('basic', this.data.form, step, question)
    this._draftDirty = false
  },

  handlePrevious(event) {
    if (!acceptNavigationTap(this, event, 'back')) return
    if (this.data.currentQuestion === 0) {
      if (this._isRouting) return
      this._isRouting = true
      this.persistDraft()
      wx.navigateBack()
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
      saveSection('basic', this.data.form)
      recordEvent('basic_updated')
      wx.reLaunch({ url: '/pages/profile/index', fail: () => { this._isRouting = false } })
      return
    }

    this._draftDirty = false
    saveSection('basic', this.data.form, 2)
    recordEvent('basic_step_complete')
    const suffix = this.data.isEditing ? '&edit=1' : ''
    wx.redirectTo({
      url: `/pages/onboarding-relationship/index?question=0${suffix}&direction=forward`,
      fail: () => { this._isRouting = false }
    })
  }
})
