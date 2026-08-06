const { WORK_STATUSES, INDUSTRIES } = require('../../utils/constants')
const { getProfile, saveSection, saveDraft } = require('../../utils/storage')
const { labelOf } = require('../../utils/formatters')
const { getStatusBarHeight } = require('../../utils/window')
const { acceptNavigationTap, getQuestionIndex, getMotionClass, showQuestion } = require('../../utils/question-flow')

const TOTAL_QUESTIONS = 19
const QUESTION_OFFSET = 14
const QUESTION_COUNT = 5
const STEP = 3

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    workStatuses: WORK_STATUSES,
    industries: INDUSTRIES,
    heights: [],
    heightIndex: 0,
    workStatusIndex: 0,
    industryIndex: 0,
    heightLabel: '',
    workStatusLabel: '',
    industryLabel: '',
    heightPickerMounted: false,
    workStatusPickerMounted: false,
    industryPickerMounted: false,
    heightPickerVisible: false,
    workStatusPickerVisible: false,
    industryPickerVisible: false,
    heightPickerValue: [],
    workStatusPickerValue: [],
    industryPickerValue: [],
    currentQuestion: 0,
    questionNumber: 15,
    progress: 15 / TOTAL_QUESTIONS,
    canContinue: false,
    continueLabel: '继续',
    nameError: '',
    occupationError: '',
    keyboardVisible: false,
    motionClass: '',
    form: {
      displayName: '',
      heightCm: '',
      workStatus: '',
      industry: '',
      occupation: ''
    },
    isEditing: false
  },

  onLoad(query) {
    const isEditing = query.edit === '1'
    const heights = [{ value: 'skip', label: '暂不填写' }]
    for (let height = 140; height <= 220; height += 1) {
      heights.push({ value: height, label: `${height} cm` })
    }
    const workStatuses = WORK_STATUSES
    const industries = [{ value: 'skip', label: '暂不填写' }].concat(INDUSTRIES)

    const profile = getProfile()
    const form = Object.assign({}, this.data.form, profile.about || {})
    const savedQuestion = profile.currentStep === STEP && Number.isInteger(profile.currentQuestion)
      ? profile.currentQuestion
      : 0
    const fallbackQuestion = isEditing ? 0 : savedQuestion
    const currentQuestion = getQuestionIndex(query, fallbackQuestion, QUESTION_COUNT)
    this.setData(Object.assign({
      heights,
      workStatuses,
      industries,
      form,
      heightIndex: Math.max(0, heights.findIndex(item => item.value === Number(form.heightCm))),
      workStatusIndex: Math.max(0, workStatuses.findIndex(item => item.value === (form.workStatus || 'skip'))),
      industryIndex: Math.max(0, industries.findIndex(item => item.value === form.industry)),
      heightLabel: form.heightCm ? `${form.heightCm} cm` : '',
      workStatusLabel: labelOf(WORK_STATUSES, form.workStatus),
      industryLabel: labelOf(INDUSTRIES, form.industry),
      heightPickerValue: [Number(form.heightCm) || 'skip'],
      workStatusPickerValue: [form.workStatus || 'skip'],
      industryPickerValue: [form.industry || 'skip'],
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

  inputDisplayName(event) {
    const value = event.detail.value.trimStart()
    const result = this.validateName(value)
    this.updateForm('displayName', value, {
      nameError: value && !result.valid ? result.message : ''
    })
  },

  inputOccupation(event) {
    const value = event.detail.value
    const result = this.validateOccupation(value)
    this.updateForm('occupation', value, {
      occupationError: result.valid ? '' : result.message
    })
  },

  handleTextFocus() {
    this.setData({ keyboardVisible: true })
  },

  handleTextBlur() {
    const updates = { keyboardVisible: false }
    if (this.data.currentQuestion === 0) {
      const result = this.validateName(this.data.form.displayName)
      updates.nameError = result.valid ? '' : result.message
    }
    if (this.data.currentQuestion === QUESTION_COUNT - 1) {
      const result = this.validateOccupation(this.data.form.occupation)
      updates.occupationError = result.valid ? '' : result.message
    }
    this.setData(updates)
  },

  handleTextKeyboardHeightChange(event) {
    const height = Number(event.detail && event.detail.height)
    this.setData({ keyboardVisible: Number.isFinite(height) && height > 0 })
  },

  handleTextConfirm(event) {
    this.setData({ keyboardVisible: false })
    wx.hideKeyboard()
    this.handleContinue(event)
  },

  changeWorkStatus(event) {
    const value = event.detail.value[0]
    const index = this.data.workStatuses.findIndex(item => item.value === value)
    const workStatus = this.data.workStatuses[index] || this.data.workStatuses[0]
    const workStatusValue = workStatus.value === 'skip' ? '' : workStatus.value
    this.updateForm('workStatus', workStatusValue, {
      workStatusIndex: index,
      workStatusLabel: workStatusValue ? workStatus.label : '',
      workStatusPickerValue: [workStatusValue || 'skip'],
      workStatusPickerVisible: false
    })
  },

  changeHeight(event) {
    const pickerValue = event.detail.value[0]
    const heightCm = pickerValue === 'skip' ? '' : Number(pickerValue)
    const index = this.data.heights.findIndex(item => item.value === (heightCm || 'skip'))
    this.updateForm('heightCm', heightCm, {
      heightIndex: index,
      heightLabel: heightCm ? `${heightCm} cm` : '',
      heightPickerValue: [heightCm || 'skip'],
      heightPickerVisible: false
    })
  },

  changeIndustry(event) {
    const value = event.detail.value[0]
    const index = this.data.industries.findIndex(item => item.value === value)
    const industry = this.data.industries[index] || this.data.industries[0]
    const industryValue = industry.value === 'skip' ? '' : industry.value
    this.updateForm('industry', industryValue, {
      industryIndex: index,
      industryLabel: industryValue ? industry.label : '',
      industryPickerValue: [industryValue || 'skip'],
      industryPickerVisible: false
    })
  },

  openHeightPicker() {
    if (this.data.heightPickerMounted) {
      this.setData({ heightPickerVisible: true })
      return
    }

    this.setData({ heightPickerMounted: true }, () => {
      wx.nextTick(() => this.setData({ heightPickerVisible: true }))
    })
  },

  closeHeightPicker() {
    this.setData({ heightPickerVisible: false })
  },

  openWorkStatusPicker() {
    if (this.data.workStatusPickerMounted) {
      this.setData({ workStatusPickerVisible: true })
      return
    }

    this.setData({ workStatusPickerMounted: true }, () => {
      wx.nextTick(() => this.setData({ workStatusPickerVisible: true }))
    })
  },

  closeWorkStatusPicker() {
    this.setData({ workStatusPickerVisible: false })
  },

  openIndustryPicker() {
    if (this.data.industryPickerMounted) {
      this.setData({ industryPickerVisible: true })
      return
    }

    this.setData({ industryPickerMounted: true }, () => {
      wx.nextTick(() => this.setData({ industryPickerVisible: true }))
    })
  },

  closeIndustryPicker() {
    this.setData({ industryPickerVisible: false })
  },

  updateForm(key, value, extra) {
    const form = Object.assign({}, this.data.form, { [key]: value })
    this.setData(Object.assign({
      form,
      nameError: key === 'displayName' ? '' : this.data.nameError
    }, this.getQuestionState(this.data.currentQuestion, form), extra || {}))
    this._draftDirty = true
  },

  validateName(value) {
    const displayName = (value || '').trim()
    const purePhone = /^1[3-9]\d{9}$/.test(displayName)
    return {
      valid: displayName.length >= 1 && displayName.length <= 12 && !purePhone,
      message: !displayName ? '请填写怎么称呼你' : purePhone ? '称呼不能是手机号' : displayName.length > 12 ? '称呼最多 12 个字符' : ''
    }
  },

  validateOccupation(value) {
    const occupation = (value || '').trim()
    const containsPhone = /1[3-9]\d{9}/.test(occupation)
    const containsEmail = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(occupation)
    return {
      valid: !containsPhone && !containsEmail,
      message: containsPhone || containsEmail ? '请只填写职业或岗位，不要填写联系方式' : ''
    }
  },

  getQuestionState(index, form, isEditing = this.data.isEditing) {
    const nameValid = this.validateName(form.displayName).valid
    const optionalValue = [null, form.heightCm, form.workStatus, form.industry, form.occupation][index]
    const labels = [
      '继续',
      optionalValue ? '继续' : '暂时跳过',
      optionalValue ? '继续' : '暂时跳过',
      optionalValue ? '继续' : '暂时跳过',
      isEditing ? '保存个人资料' : '生成我的介绍'
    ]
    return {
      questionNumber: QUESTION_OFFSET + index + 1,
      progress: (QUESTION_OFFSET + index + 1) / TOTAL_QUESTIONS,
      canContinue: index === 0 ? nameValid : true,
      continueLabel: labels[index]
    }
  },

  transitionTo(index, direction) {
    if (!showQuestion(this, index, QUESTION_COUNT, direction)) return
    this.setData({ nameError: '' })
    this._draftDirty = true
  },

  persistDraft(step = STEP, question = this.data.currentQuestion) {
    if (this.data.isEditing || !this._draftDirty) return
    saveDraft('about', this.data.form, step, question)
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
      this.persistDraft(2, 9)
      wx.redirectTo({ url: '/pages/onboarding-relationship/index?question=9&direction=back' })
      return
    }
    this.transitionTo(this.data.currentQuestion - 1, 'back')
  },

  handleContinue(event) {
    if (!acceptNavigationTap(this, event, 'continue')) return
    if (this.data.currentQuestion === 0) {
      const result = this.validateName(this.data.form.displayName)
      this.setData({ nameError: result.message, canContinue: result.valid })
      if (!result.valid) return
    }

    if (this.data.currentQuestion === QUESTION_COUNT - 1) {
      const result = this.validateOccupation(this.data.form.occupation)
      this.setData({ occupationError: result.message })
      if (!result.valid) return
    }

    if (this.data.currentQuestion < QUESTION_COUNT - 1) {
      this.transitionTo(this.data.currentQuestion + 1, 'forward')
      return
    }

    const form = Object.assign({}, this.data.form, { displayName: this.data.form.displayName.trim() })
    if (this._isRouting) return
    this._isRouting = true
    if (this.data.isEditing) {
      saveSection('about', form)
      wx.reLaunch({ url: '/pages/profile/index', fail: () => { this._isRouting = false } })
      return
    }

    this._draftDirty = false
    saveSection('about', form, 4)
    wx.navigateTo({ url: '/pages/profile-preview/index', fail: () => { this._isRouting = false } })
  }
})
