const { MEETING_TIMES, COMMUTE_TOLERANCE, SCHEDULE_PATTERNS, MARRIAGE_TIMELINES, PARENT_COHABITATION, FINANCE_STYLES, HOUSEWORK_STYLES, PET_ACCEPTANCE, ALCOHOL_ACCEPTANCE, SOCIAL_RHYTHMS } = require('../../utils/constants')
const { getProfile, saveSection, saveDraft, recordEvent } = require('../../utils/storage')
const { getStatusBarHeight } = require('../../utils/window')
const { acceptNavigationTap, getQuestionIndex, getMotionClass, showQuestion } = require('../../utils/question-flow')

const TOTAL_QUESTIONS = 29
const QUESTION_OFFSET = 14
const QUESTION_COUNT = 10
const STEP = 3
const FIELDS = ['meetingTimes', 'commuteTolerance', 'schedulePattern', 'marriageTimeline', 'parentCohabitation', 'financeStyle', 'houseworkStyle', 'petAcceptance', 'alcoholAcceptance', 'socialRhythm']

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    meetingTimeOptions: MEETING_TIMES.map(item => Object.assign({}, item, { selected: false })),
    commuteOptions: COMMUTE_TOLERANCE,
    scheduleOptions: SCHEDULE_PATTERNS,
    marriageTimelineOptions: MARRIAGE_TIMELINES,
    parentCohabitationOptions: PARENT_COHABITATION,
    financeOptions: FINANCE_STYLES,
    houseworkOptions: HOUSEWORK_STYLES,
    petOptions: PET_ACCEPTANCE,
    alcoholOptions: ALCOHOL_ACCEPTANCE,
    socialOptions: SOCIAL_RHYTHMS,
    currentQuestion: 0,
    questionNumber: 15,
    progress: 15 / TOTAL_QUESTIONS,
    canContinue: false,
    continueLabel: '继续',
    motionClass: '',
    form: { meetingTimes: [], commuteTolerance: '', schedulePattern: '', marriageTimeline: '', parentCohabitation: '', financeStyle: '', houseworkStyle: '', petAcceptance: '', alcoholAcceptance: '', socialRhythm: '' },
    isEditing: false
  },
  onLoad(query) {
    const profile = getProfile()
    const form = Object.assign({}, this.data.form, profile.reality || {})
    if (!Array.isArray(form.meetingTimes)) form.meetingTimes = []
    const isEditing = query.edit === '1'
    const required = FIELDS.map(field => field === 'meetingTimes' ? form.meetingTimes.length : form[field])
    const firstMissing = required.findIndex(value => !value)
    const savedQuestion = profile.currentStep === STEP && Number.isInteger(profile.currentQuestion) ? profile.currentQuestion : firstMissing === -1 ? QUESTION_COUNT - 1 : firstMissing
    const currentQuestion = getQuestionIndex(query, isEditing ? 0 : savedQuestion, QUESTION_COUNT)
    this.setData(Object.assign({ form, meetingTimeOptions: MEETING_TIMES.map(item => Object.assign({}, item, { selected: form.meetingTimes.includes(item.value) })), currentQuestion, motionClass: getMotionClass(query.direction), isEditing }, this.getQuestionState(currentQuestion, form, isEditing)))
  },
  onHide() { this.persistDraft() },
  onUnload() { this.persistDraft() },
  toggleMeetingTime(event) {
    const value = event.currentTarget.dataset.value
    const current = this.data.form.meetingTimes
    const meetingTimes = current.includes(value) ? current.filter(item => item !== value) : current.concat(value)
    this.updateForm('meetingTimes', meetingTimes, { meetingTimeOptions: this.data.meetingTimeOptions.map(item => Object.assign({}, item, { selected: meetingTimes.includes(item.value) })) })
  },
  chooseOption(event) { this.updateForm(event.currentTarget.dataset.field, event.currentTarget.dataset.value) },
  updateForm(key, value, extra) {
    const form = Object.assign({}, this.data.form, { [key]: value })
    this.setData(Object.assign({ form }, this.getQuestionState(this.data.currentQuestion, form), extra || {}))
    this._draftDirty = true
  },
  getQuestionState(index, form, isEditing = this.data.isEditing) {
    const value = form[FIELDS[index]]
    const valid = Array.isArray(value) ? value.length > 0 : Boolean(value)
    return { questionNumber: QUESTION_OFFSET + index + 1, progress: (QUESTION_OFFSET + index + 1) / TOTAL_QUESTIONS, canContinue: valid, continueLabel: index === QUESTION_COUNT - 1 ? (isEditing ? '保存现实安排' : '进入个人资料') : '继续' }
  },
  transitionTo(index, direction) { if (showQuestion(this, index, QUESTION_COUNT, direction)) this._draftDirty = true },
  persistDraft(step = STEP, question = this.data.currentQuestion) { if (this.data.isEditing || !this._draftDirty) return; saveDraft('reality', this.data.form, step, question); this._draftDirty = false },
  handlePrevious(event) {
    if (!acceptNavigationTap(this, event, 'back')) return
    if (this.data.currentQuestion > 0) { this.transitionTo(this.data.currentQuestion - 1, 'back'); return }
    if (this._isRouting) return
    this._isRouting = true
    if (this.data.isEditing) { wx.navigateBack(); return }
    this._draftDirty = true
    this.persistDraft(2, 9)
    wx.redirectTo({ url: '/pages/onboarding-relationship/index?question=9&direction=back', fail: () => { this._isRouting = false } })
  },
  handleContinue(event) {
    if (!acceptNavigationTap(this, event, 'continue') || !this.data.canContinue) return
    if (this.data.currentQuestion < QUESTION_COUNT - 1) { this.transitionTo(this.data.currentQuestion + 1, 'forward'); return }
    if (this._isRouting) return
    this._isRouting = true
    saveSection('reality', this.data.form, this.data.isEditing ? undefined : 4)
    recordEvent('reality_updated')
    if (this.data.isEditing) { wx.reLaunch({ url: '/pages/profile/index', fail: () => { this._isRouting = false } }); return }
    this._draftDirty = false
    wx.redirectTo({ url: '/pages/onboarding-about/index?question=0&direction=forward', fail: () => { this._isRouting = false } })
  }
})
