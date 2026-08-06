const { RESPONSE_SCALES, getModule } = require('../../utils/questionnaire-definitions')
const { latestAnswers } = require('../../utils/questionnaire-record')
const {
  getQuestionnaireData,
  saveQuestionnaireAnswer,
  completeQuestionnaireModule,
  recordEvent
} = require('../../utils/storage')
const { saveQuestionnaireModuleToCloud } = require('../../utils/cloud')
const { getStatusBarHeight } = require('../../utils/window')
const { acceptNavigationTap, getQuestionIndex, getMotionClass, showQuestion } = require('../../utils/question-flow')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

const DEFAULT_MODULE_ID = 'current_relationship_readiness'

function responseOptions(item) {
  const scale = RESPONSE_SCALES[item.scaleId]
  return scale.values.map((value, index) => ({ value, label: scale.labels[index] }))
}

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    moduleTitle: '',
    moduleInstruction: '',
    currentQuestion: 0,
    questionNumber: 1,
    questionCount: 0,
    progress: 0,
    item: null,
    dimensionTitle: '',
    responseOptions: [],
    specialOptions: [],
    selectedValue: '',
    canContinue: false,
    continueLabel: '继续',
    motionClass: ''
  },

  onLoad(query) {
    const moduleId = query.module || DEFAULT_MODULE_ID
    const module = getModule(moduleId)
    if (!module) {
      navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
      return
    }
    this.moduleId = moduleId
    this.module = module
    const moduleRecord = getQuestionnaireData().modules[moduleId]
    if (moduleRecord && moduleRecord.status === 'complete' && query.revise !== '1') {
      navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire-result/index?module=${moduleId}` })
      return
    }
    this.answers = moduleRecord ? latestAnswers(moduleRecord) : {}
    const firstUnvisited = module.items.findIndex(item => !(item.id in this.answers))
    const fallback = firstUnvisited >= 0 ? firstUnvisited : 0
    const currentQuestion = getQuestionIndex(query, fallback, module.items.length)
    this.setData(Object.assign({
      moduleTitle: module.shortTitle || module.title,
      moduleInstruction: module.instruction,
      questionCount: module.items.length,
      currentQuestion,
      motionClass: getMotionClass(query.direction)
    }, this.getQuestionState(currentQuestion)))
    recordEvent('questionnaire_start', { moduleId, resumed: Boolean(moduleRecord) })
  },

  onShow() {
    resetNavigation(this)
  },

  getQuestionState(index) {
    const item = this.module.items[index]
    const options = responseOptions(item)
    const selectedValue = item.id in this.answers ? this.answers[item.id] : ''
    const dimension = this.module.dimensions.find(current => current.id === item.dimensionId)
    return {
      item,
      dimensionTitle: dimension ? dimension.title : '',
      questionNumber: index + 1,
      progress: (index + 1) / this.module.items.length,
      responseOptions: options.filter(option => typeof option.value === 'number'),
      specialOptions: options.filter(option => typeof option.value !== 'number'),
      selectedValue,
      canContinue: selectedValue !== '',
      continueLabel: index === this.module.items.length - 1 ? '查看这一部分' : '继续'
    }
  },

  chooseAnswer(event) {
    if (this._isRouting) return
    const value = event.currentTarget.dataset.value
    this.commitAnswer(value)
  },

  chooseSpecial(event) {
    if (this._isRouting) return
    this.commitAnswer(event.currentTarget.dataset.value)
  },

  commitAnswer(value) {
    const item = this.module.items[this.data.currentQuestion]
    if (this.answers[item.id] === value) return
    const result = saveQuestionnaireAnswer(this.moduleId, item.id, value)
    this.answers = Object.assign({}, this.answers, { [item.id]: value })
    this.setData({ selectedValue: value, canContinue: true })
    recordEvent('questionnaire_answered', { moduleId: this.moduleId, itemId: item.id, value })
    this.queueCloudSync(result.data.modules[this.moduleId])
  },

  queueCloudSync(moduleRecord) {
    this._pendingModuleRecord = moduleRecord
    if (this._syncInFlight) return
    this.flushCloudSync()
  },

  flushCloudSync() {
    const moduleRecord = this._pendingModuleRecord
    if (!moduleRecord) return
    this._pendingModuleRecord = null
    this._syncInFlight = true
    saveQuestionnaireModuleToCloud(moduleRecord, {
      success: () => {
        this._syncInFlight = false
        if (this._pendingModuleRecord) {
          this.flushCloudSync()
          return
        }
        recordEvent('questionnaire_cloud_sync_succeeded', { moduleId: this.moduleId })
      },
      fail: () => {
        this._syncInFlight = false
        recordEvent('questionnaire_cloud_sync_failed', { moduleId: this.moduleId })
        if (this._pendingModuleRecord) this.flushCloudSync()
      }
    })
  },

  transitionTo(index, direction) {
    if (!showQuestion(this, index, this.module.items.length, direction)) return
    this.setData(this.getQuestionState(index))
  },

  handlePrevious(event) {
    if (!acceptNavigationTap(this, event, 'back')) return
    if (this.data.currentQuestion === 0) {
      navigateOnce(this, 'navigateBack', {
        fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
      })
      return
    }
    this.transitionTo(this.data.currentQuestion - 1, 'back')
  },

  handleContinue(event) {
    if (!acceptNavigationTap(this, event, 'continue') || !this.data.canContinue) return
    if (this.data.currentQuestion < this.module.items.length - 1) {
      this.transitionTo(this.data.currentQuestion + 1, 'forward')
      return
    }
    try {
      const data = completeQuestionnaireModule(this.moduleId)
      this.queueCloudSync(data.modules[this.moduleId])
      recordEvent('questionnaire_complete', { moduleId: this.moduleId })
      navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire-result/index?module=${this.moduleId}` })
    } catch (error) {
      wx.showToast({ title: '还有题目未回答或跳过', icon: 'none' })
    }
  }
})
