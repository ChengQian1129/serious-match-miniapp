const { questions, buildExplorationResult, hasCompleteAnswers } = require('../../utils/exploration')
const { getExploration, saveExplorationDraft, completeExploration, recordEvent } = require('../../utils/storage')
const { getStatusBarHeight } = require('../../utils/window')
const { acceptNavigationTap, getQuestionIndex, getMotionClass, showQuestion } = require('../../utils/question-flow')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

const QUESTION_COUNT = questions.length

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    questions,
    currentQuestion: 0,
    question: questions[0],
    questionNumber: 1,
    progress: 1 / QUESTION_COUNT,
    answers: {},
    selectedValue: '',
    canContinue: false,
    continueLabel: '继续',
    motionClass: ''
  },

  onLoad(query) {
    const exploration = getExploration()
    if (exploration.status === 'saved') {
      navigateOnce(this, 'redirectTo', { url: '/pages/exploration-result/index' })
      return
    }
    const fallback = exploration.status === 'draft' && Number.isInteger(exploration.currentQuestion)
      ? exploration.currentQuestion
      : 0
    const currentQuestion = getQuestionIndex(query, fallback, QUESTION_COUNT)
    const answers = exploration.answers || {}
    this.setData(Object.assign({
      currentQuestion,
      answers,
      motionClass: getMotionClass(query.direction)
    }, this.getQuestionState(currentQuestion, answers)))
    recordEvent('exploration_start', { resumed: Object.keys(answers).length > 0 })
  },

  onShow() {
    resetNavigation(this)
  },

  onHide() {
    this.persistDraft()
  },

  onUnload() {
    this.persistDraft()
  },

  getQuestionState(index, answers) {
    answers = answers || this.data.answers || {}
    const question = questions[index]
    const selectedValue = answers[question.id] || ''
    return {
      question,
      questionNumber: index + 1,
      progress: (index + 1) / QUESTION_COUNT,
      selectedValue,
      canContinue: Boolean(selectedValue),
      continueLabel: index === QUESTION_COUNT - 1 ? '查看初步结果' : '继续'
    }
  },

  chooseAnswer(event) {
    const value = event.currentTarget.dataset.value
    const question = questions[this.data.currentQuestion]
    const answers = Object.assign({}, this.data.answers, { [question.id]: value })
    this.setData({
      answers,
      selectedValue: value,
      canContinue: true
    })
    this._draftDirty = true
  },

  transitionTo(index, direction) {
    if (!showQuestion(this, index, QUESTION_COUNT, direction)) return
    this._draftDirty = true
  },

  persistDraft(question = this.data.currentQuestion) {
    if (this._completed || !this._draftDirty) return
    saveExplorationDraft(this.data.answers, question)
    this._draftDirty = false
  },

  handlePrevious(event) {
    if (!acceptNavigationTap(this, event, 'back')) return
    if (this.data.currentQuestion === 0) {
      this.persistDraft(0)
      navigateOnce(this, 'navigateBack', {})
      return
    }

    this.persistDraft(this.data.currentQuestion - 1)
    this.transitionTo(this.data.currentQuestion - 1, 'back')
  },

  handleContinue(event) {
    if (!acceptNavigationTap(this, event, 'continue') || !this.data.canContinue) return
    const question = questions[this.data.currentQuestion]
    recordEvent('exploration_question_answered', {
      questionId: question.id,
      answer: this.data.selectedValue
    })

    if (this.data.currentQuestion < QUESTION_COUNT - 1) {
      this.persistDraft(this.data.currentQuestion + 1)
      this.transitionTo(this.data.currentQuestion + 1, 'forward')
      return
    }

    if (!hasCompleteAnswers(this.data.answers)) return
    const result = buildExplorationResult(this.data.answers)
    if (!result) return
    completeExploration(this.data.answers, result)
    this._completed = true
    recordEvent('exploration_complete')
    navigateOnce(this, 'redirectTo', { url: '/pages/exploration-result/index' })
  }
})
