const { getSession, setPosition, answerItem, completeChapter, shouldSyncAssessment, markSynced } = require('../../utils/assessment-v2/session-store')
const { getChapter, getItem, optionsFor } = require('../../utils/assessment-v2/questionnaire-definitions')
const { saveAssessmentDraftToCloud } = require('../../utils/cloud')
const { getStatusBarHeight } = require('../../utils/window')
const { acceptNavigationTap, getMotionClass, showQuestion } = require('../../utils/question-flow')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')

Page({
  data: { statusBarHeight: getStatusBarHeight(), moduleTitle: '', moduleInstruction: '', currentQuestion: 0, questionNumber: 1, questionCount: 8, progress: 0, item: null, dimensionTitle: '', responseOptions: [], specialOptions: [], selectedValue: '', canContinue: false, continueLabel: '继续', motionClass: '' },

  onLoad(query) {
    this.chapterId = query.chapter || getSession().currentChapterId || 'C1'
    this.chapter = getChapter(this.chapterId)
    if (!this.chapter) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.session = getSession()
    const requested = Number(query.question)
    const firstUnanswered = this.chapter.itemIds.findIndex(id => !(id in this.session.answers))
    const index = Number.isInteger(requested) && requested >= 0 && requested < 8 ? requested : (firstUnanswered >= 0 ? firstUnanswered : 0)
    this.setData(Object.assign({ moduleTitle: this.chapter.title, moduleInstruction: this.chapter.instruction, questionCount: 8, currentQuestion: index, motionClass: getMotionClass(query.direction) }, this.getQuestionState(index)))
    recordEvent('assessment_v2_chapter_start', { chapterId: this.chapterId, resumed: Boolean(Object.keys(this.session.answers).length) })
  },

  onShow() {
    resetNavigation(this)
    const session = getSession()
    if (shouldSyncAssessment() && session.status === 'pending_cloud') this.queueCloudSync(session)
  },

  getQuestionState(index) {
    const item = getItem(this.chapter.itemIds[index])
    const options = optionsFor(item)
    const selectedValue = this.session.answers[item.id] === undefined ? '' : this.session.answers[item.id]
    return { item, dimensionTitle: item.role === 'profile' ? '关系档案线索' : '当前正在了解的主题', questionNumber: index + 1, progress: (index + 1) / 8, responseOptions: options.filter(option => typeof option.value === 'number'), specialOptions: options.filter(option => typeof option.value !== 'number'), selectedValue, canContinue: selectedValue !== '', continueLabel: index === 7 ? '查看阶段发现' : '继续' }
  },

  chooseAnswer(event) { this.commitAnswer(event.currentTarget.dataset.value) },
  chooseSpecial(event) { this.commitAnswer(event.currentTarget.dataset.value) },
  commitAnswer(rawValue) {
    if (this._isRouting) return
    const value = ['NA', 'SKIP'].includes(rawValue) ? rawValue : Number(rawValue)
    if (this.data.selectedValue === value) return
    const itemId = this.chapter.itemIds[this.data.currentQuestion]
    this.session = answerItem(itemId, value, { chapterId: this.chapterId, itemIndex: this.data.currentQuestion })
    this.setData({ selectedValue: value, canContinue: true })
    recordEvent('assessment_v2_answered', { chapterId: this.chapterId, itemId })
    if (shouldSyncAssessment()) this.queueCloudSync(this.session)
  },

  queueCloudSync(session) {
    this._pendingSession = session
    if (!this._syncInFlight) this.flushCloudSync()
  },

  flushCloudSync() {
    const session = this._pendingSession
    if (!session) return
    this._pendingSession = null
    this._syncInFlight = true
    saveAssessmentDraftToCloud(session, {
      success: () => {
        this._syncInFlight = false
        if (this._pendingSession) return this.flushCloudSync()
        this.session = markSynced()
        recordEvent('assessment_v2_draft_synced')
      },
      fail: () => {
        this._syncInFlight = false
        recordEvent('assessment_v2_draft_sync_failed')
        if (this._pendingSession) return this.flushCloudSync()
      }
    })
  },

  transitionTo(index, direction) {
    this.session = setPosition(this.chapterId, index)
    showQuestion(this, index, 8, direction)
  },
  handlePrevious(event) {
    if (!acceptNavigationTap(this, event, 'back')) return
    if (this.data.currentQuestion === 0) return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) })
    this.transitionTo(this.data.currentQuestion - 1, 'back')
  },
  handleContinue(event) {
    if (!acceptNavigationTap(this, event, 'continue') || !this.data.canContinue) return
    if (this.data.currentQuestion < 7) return this.transitionTo(this.data.currentQuestion + 1, 'forward')
    try {
      const completedChapter = completeChapter(this.chapterId)
      this.session = completedChapter
      if (shouldSyncAssessment()) this.queueCloudSync(completedChapter)
      navigateOnce(this, 'redirectTo', { url: `/pages/chapter-insight/index?chapter=${this.chapterId}` })
    } catch (error) { wx.showToast({ title: error.message || '请完成这一章', icon: 'none' }) }
  }
})
