const { FEATURES } = require('../../utils/features')
const { CHAPTERS } = require('../../shared/assessment-v3-product/contract')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildPartialReport, buildChapterView, PRODUCT_COPY, PRODUCT_V0_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')
const productJourney = require('../../utils/assessment-v3-product-v0/journey-model')
const cloud = require('../../utils/cloud')
const { recordEvent } = require('../../utils/storage')
const { CONTENT_VERSION } = require('../../shared/content/version')

function feedbackFields() {
  return {
    feedbackValue: '',
    feedbackReason: '',
    feedbackSubmitted: false,
    feedbackSyncing: false,
    feedbackSyncError: ''
  }
}

function decorateProductReport(report) {
  if (!report || report.source !== 'THEORY_DRIVEN_PRODUCT_V0') return report
  const executiveSummary = report.executiveSummary || {}
  return Object.assign({}, report, {
    executiveSummary: Object.assign({}, executiveSummary, {
      patterns: (executiveSummary.patterns || []).map(item => Object.assign({}, item, feedbackFields()))
    })
  })
}

function chapterViews(report) {
  return CHAPTERS.map(chapter => buildChapterView(report, chapter.id)).filter(Boolean).map(chapter => Object.assign({}, chapter, feedbackFields(), {
    expanded: false,
    dimensionCards: (chapter.dimensionCards || []).map(item => Object.assign({}, item, feedbackFields()))
  }))
}

function replaceTemplate(template, values) {
  return Object.keys(values || {}).reduce((result, key) => result.replace(`{${key}}`, String(values[key])), String(template || ''))
}

function journeySectionViews(session, copy = PRODUCT_V0_COPY) {
  const global = productJourney.getGlobalProgress(session, copy)
  const statusCopy = copy.home || {}
  return productJourney.getSections(copy).map(section => {
    const progress = productJourney.getSectionProgress(session, section.id, copy)
    const isComplete = progress.isComplete
    const hasStarted = progress.completedTasks > 0
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      progressText: `${progress.completedTasks} / ${progress.totalTasks}`,
      status: isComplete ? 'complete' : hasStarted ? 'in_progress' : 'locked',
      statusLabel: isComplete ? (statusCopy.statusComplete || '已完成') : hasStarted ? (statusCopy.statusInProgress || '进行中') : (statusCopy.statusLocked || '尚未完成'),
      isComplete,
      canOpen: isComplete,
      sectionNumber: progress.sectionNumber,
      sectionCount: progress.sectionCount,
      completedTasks: progress.completedTasks,
      totalTasks: progress.totalTasks,
      globalCompletedSections: global.completedSections,
      globalTotalSections: global.totalSections
    }
  })
}

function productResultUrl(scope) {
  return `/pages/v3-result/index?mode=product-v0${scope === 'partial' ? '&scope=partial' : ''}`
}

function questionnaireVersionForReport(report) {
  return report && (report.questionnaireVersion || report.productQuestionnaireVersion || (report.assessmentMeta && report.assessmentMeta.productQuestionnaireVersion)) || null
}

function updateTargetViews(page, targetType, targetId, fields) {
  if (targetType === 'pattern') {
    const report = page.data.report || {}
    const executiveSummary = report.executiveSummary || {}
    const patterns = (executiveSummary.patterns || []).map(item => item.id === targetId ? Object.assign({}, item, fields) : item)
    return { report: Object.assign({}, report, { executiveSummary: Object.assign({}, executiveSummary, { patterns }) }) }
  }
  const chapters = (page.data.chapters || []).map(chapter => {
    if (targetType === 'chapter' && chapter.id === targetId) return Object.assign({}, chapter, fields)
    if (targetType === 'dimension' && chapter.dimensionCards) {
      return Object.assign({}, chapter, { dimensionCards: chapter.dimensionCards.map(item => item.id === targetId ? Object.assign({}, item, fields) : item) })
    }
    return chapter
  })
  return { chapters }
}

function targetView(page, targetType, targetId) {
  if (targetType === 'pattern') return page.data.report && page.data.report.executiveSummary && (page.data.report.executiveSummary.patterns || []).find(item => item.id === targetId)
  for (const chapter of page.data.chapters || []) {
    if (targetType === 'chapter' && chapter.id === targetId) return chapter
    if (targetType === 'dimension') {
      const dimension = (chapter.dimensionCards || []).find(item => item.id === targetId)
      if (dimension) return dimension
    }
  }
  return null
}

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    report: null,
    chapters: [],
    personaId: '',
    syncing: false,
    syncError: '',
    mode: '',
    isPartial: false,
    isComplete: false,
    emptyState: false,
    journeySections: [],
    completedSectionsLabel: '',
    resultNotice: '',
    summaryFallback: '',
    hasPatterns: false,
    hasDecisions: false,
    hasUnknowns: false,
    hasInterview: false,
    feedbackValue: '',
    feedbackReason: '',
    feedbackSubmitted: false,
    feedbackReasons: [],
    feedbackSyncing: false,
    feedbackSyncError: ''
  },

  onLoad(options = {}) {
    if (options.mode === 'product-v0') {
      if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      this.mode = 'product-v0'
      this.scope = options.scope || ''
      this.setData({ copy: PRODUCT_V0_COPY })
      this.loadReport()
      return
    }
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.loadReport()
  },

  onShow() {
    resetNavigation(this)
    if (this.mode === 'product-v0' || this.personaId) {
      this.loadReport()
      if (this.mode === 'product-v0') this.syncProductReport()
    }
  },

  loadReport() {
    if (this.mode === 'product-v0') {
      const session = productStore.getSession()
      const hasAnswers = Boolean(session.answerEvents && session.answerEvents.length)
      const isComplete = Boolean(session.completedAt && productJourney.isAssessmentComplete(session, PRODUCT_V0_COPY))
      if (!hasAnswers && !isComplete) {
        this.setData({ ready: true, emptyState: true, copy: PRODUCT_V0_COPY, report: null, chapters: [], journeySections: journeySectionViews(session), personaId: '', syncError: '' })
        return
      }
      let report = isComplete ? productStore.getReport() : null
      const profile = session.derivedProfile || productRuntime.deriveProfile(session)
      if (!report || report.source !== 'THEORY_DRIVEN_PRODUCT_V0' || !isComplete) {
        const completedSections = productJourney.getCompletedSections(session, PRODUCT_V0_COPY).map(section => section.id)
        report = isComplete
          ? Object.assign({ reportVersion: session.reportRevision || Number(session.reportVersion) || 1, generatedAt: session.completedAt || Date.now() }, buildReport(profile))
          : buildPartialReport(profile, completedSections)
        if (isComplete) productStore.saveReport(report)
      }
      const partial = !isComplete
      const global = productJourney.getGlobalProgress(session, PRODUCT_V0_COPY)
      const completedSectionsLabel = replaceTemplate((PRODUCT_V0_COPY.preview && PRODUCT_V0_COPY.preview.completedSectionsTemplate) || (PRODUCT_V0_COPY.home && PRODUCT_V0_COPY.home.completedSectionsTemplate) || '已完成 {completed} / {total} 个部分', { completed: global.completedSections, total: global.totalSections })
      const viewReport = decorateProductReport(report)
      this.setData({
        ready: true,
        emptyState: false,
        copy: PRODUCT_V0_COPY,
        report: viewReport,
        chapters: chapterViews(viewReport),
        journeySections: journeySectionViews(session),
        personaId: '',
        isPartial: partial,
        isComplete: isComplete,
        completedSectionsLabel,
        resultNotice: partial ? ((PRODUCT_V0_COPY.preview && PRODUCT_V0_COPY.preview.partialNotice) || '目前只显示已经完成的部分；继续回答后，结果会逐步补充。') : report.notice,
        summaryFallback: partial ? ((PRODUCT_V0_COPY.preview && PRODUCT_V0_COPY.preview.lockedSectionBody) || '') : ((PRODUCT_V0_COPY.fallback && PRODUCT_V0_COPY.fallback.patternSummary) || '目前的回答还不足以支持稳定判断。'),
        hasPatterns: Boolean(report.executiveSummary && report.executiveSummary.patterns && report.executiveSummary.patterns.length),
        hasDecisions: Boolean(report.decisionMap && report.decisionMap.sections && report.decisionMap.sections.length),
        hasUnknowns: Boolean(report.unknowns && report.unknowns.items && report.unknowns.items.length),
        hasInterview: Boolean(report.interviewPriorities && report.interviewPriorities.items && report.interviewPriorities.items.length),
        feedbackReasons: Object.keys((PRODUCT_V0_COPY.feedback && PRODUCT_V0_COPY.feedback.reasons) || {}).map(id => ({ id, label: PRODUCT_V0_COPY.feedback.reasons[id] })),
        syncError: ''
      })
      return
    }
    const report = buildReport(getFixture(this.personaId))
    this.setData({ ready: true, emptyState: false, mode: '', copy: PRODUCT_COPY, report, chapters: chapterViews(report), personaId: this.personaId || '', isPartial: false, isComplete: true, resultNotice: report.notice, summaryFallback: (PRODUCT_COPY.fallback && PRODUCT_COPY.fallback.patternSummary) || '', hasPatterns: Boolean(report.executiveSummary.patterns.length), hasDecisions: true, hasUnknowns: true, hasInterview: true })
  },

  syncProductReport() {
    if (this._productSyncing || this._productMutationInFlight || !cloud.isCloudReady()) return
    const session = productStore.getSession()
    if (!session.completedAt || !session.answerEvents.length) return
    const report = productStore.getReport()
    if (report && report._id && session.status === 'completed') return
    this._productSyncing = true
    const syncToken = (this._productSyncToken || 0) + 1
    this._productSyncToken = syncToken
    this.setData({ syncing: true, syncError: '' })
    cloud.completeProductV0ToCloud(session, {
      success: data => {
        this._productSyncing = false
        if (syncToken !== this._productSyncToken || this._productMutationInFlight) return
        if (data && data.session) productStore.replaceSession(data.session)
        if (data && data.report) productStore.replaceReport(data.report)
        this.setData({ syncing: false, syncError: '' })
        this.loadReport()
      },
      fail: error => {
        this._productSyncing = false
        if (syncToken !== this._productSyncToken || this._productMutationInFlight) return
        this.setData({ syncing: false, syncError: cloud.cloudErrorMessage(error) })
      }
    })
  },

  beginProductMutation() {
    this._productSyncToken = (this._productSyncToken || 0) + 1
    this._productSyncing = false
    this._productMutationInFlight = true
  },

  endProductMutation() {
    this._productMutationInFlight = false
  },

  openEvidence(event) {
    const dimensionId = event.currentTarget.dataset.dimensionId
    if (!dimensionId) return
    const returnTo = this.mode === 'product-v0' ? `&returnTo=${encodeURIComponent(productResultUrl(this.data.isPartial ? 'partial' : ''))}` : ''
    const query = this.mode === 'product-v0' ? `mode=product-v0&dimension=${encodeURIComponent(dimensionId)}${returnTo}` : `persona=${encodeURIComponent(this.personaId)}&dimension=${encodeURIComponent(dimensionId)}`
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result-evidence/index?${query}` })
  },

  openChapter(event) {
    const chapterId = event.currentTarget.dataset.chapterId
    if (!chapterId) return
    const query = this.mode === 'product-v0' ? `mode=product-v0&section=${encodeURIComponent(chapterId)}` : `persona=${encodeURIComponent(this.personaId)}&chapter=${encodeURIComponent(chapterId)}`
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?${query}` })
  },

  openSection(event) {
    const sectionId = event.currentTarget.dataset.sectionId
    const section = this.data.journeySections.find(item => item.id === sectionId)
    if (!section || !section.canOpen) return
    const query = `mode=product-v0&section=${encodeURIComponent(sectionId)}`
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?${query}` })
  },

  toggleChapter(event) {
    const chapterId = event.currentTarget.dataset.chapterId
    if (!chapterId) return
    const chapters = this.data.chapters.map(chapter => chapter.id === chapterId ? Object.assign({}, chapter, { expanded: !chapter.expanded }) : chapter)
    this.setData({ chapters })
  },

  openFollowup() {
    if (this.mode !== 'product-v0') return
    navigateOnce(this, 'navigateTo', { url: '/pages/followup-intro/index?returnTo=product-v0' })
  },

  openAnswerReview() {
    if (this.mode !== 'product-v0') return this.startAtFirstChapter()
    const returnTo = productResultUrl(this.data.isPartial ? 'partial' : '')
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-answer-review/index?mode=product-v0&returnTo=${encodeURIComponent(returnTo)}` })
  },

  openContinue() {
    if (this.mode !== 'product-v0') return this.startAtFirstChapter()
    const session = productStore.getSession()
    navigateOnce(this, 'navigateTo', { url: `/pages/questionnaire-v3/index?index=${encodeURIComponent(session.currentTaskIndex || 0)}` })
  },

  selectFeedback(event) {
    this.setData({ feedbackValue: event.currentTarget.dataset.value || '', feedbackReason: '' })
  },

  selectFeedbackReason(event) {
    this.setData({ feedbackReason: event.currentTarget.dataset.reason || '' })
  },

  selectTargetFeedback(event) {
    const targetType = event.currentTarget.dataset.targetType
    const targetId = event.currentTarget.dataset.targetId
    const value = event.currentTarget.dataset.value
    if (!['pattern', 'chapter', 'dimension'].includes(targetType) || !targetId || !['fits', 'does_not_fit'].includes(value)) return
    this.setData(updateTargetViews(this, targetType, targetId, {
      feedbackValue: value,
      feedbackReason: '',
      feedbackSubmitted: false,
      feedbackSyncing: false,
      feedbackSyncError: ''
    }))
  },

  selectTargetFeedbackReason(event) {
    const targetType = event.currentTarget.dataset.targetType
    const targetId = event.currentTarget.dataset.targetId
    const reason = event.currentTarget.dataset.reason || ''
    if (!['pattern', 'chapter', 'dimension'].includes(targetType) || !targetId) return
    this.setData(updateTargetViews(this, targetType, targetId, { feedbackReason: reason, feedbackSubmitted: false, feedbackSyncError: '' }))
  },

  submitTargetFeedback(event) {
    const targetType = event.currentTarget.dataset.targetType
    const targetId = event.currentTarget.dataset.targetId
    if (!['pattern', 'chapter', 'dimension'].includes(targetType) || !targetId) return
    const target = targetView(this, targetType, targetId)
    if (!target || !target.feedbackValue || target.feedbackSubmitted || this._targetFeedbackInFlight) return
    const report = this.data.report
    const feedbackEvent = {
      eventId: `product-feedback-${targetType}-${targetId}-${Date.now()}`,
      targetType,
      targetId,
      value: target.feedbackValue,
      reasonCode: target.feedbackReason || '',
      createdAt: Date.now(),
      contentVersion: CONTENT_VERSION,
      questionnaireVersion: questionnaireVersionForReport(report)
    }
    recordEvent('assessment_feedback', {
      targetType,
      targetId,
      value: feedbackEvent.value,
      reasonCode: feedbackEvent.reasonCode
    })
    if (!report || !report._id || !cloud.isCloudReady()) {
      return this.setData(updateTargetViews(this, targetType, targetId, { feedbackSubmitted: true, feedbackSyncing: false, feedbackSyncError: '' }))
    }
    this._targetFeedbackInFlight = true
    this.setData(updateTargetViews(this, targetType, targetId, { feedbackSyncing: true, feedbackSyncError: '' }))
    cloud.appendAssessmentFeedbackToCloud(report._id, feedbackEvent, {
      success: () => {
        this._targetFeedbackInFlight = false
        this.setData(updateTargetViews(this, targetType, targetId, { feedbackSubmitted: true, feedbackSyncing: false, feedbackSyncError: '' }))
      },
      fail: error => {
        this._targetFeedbackInFlight = false
        this.setData(updateTargetViews(this, targetType, targetId, { feedbackSubmitted: false, feedbackSyncing: false, feedbackSyncError: cloud.cloudErrorMessage(error) }))
      }
    })
  },

  submitFeedback() {
    if (this.data.feedbackSubmitted || this._feedbackInFlight || !this.data.feedbackValue) return
    const value = this.data.feedbackValue
    const reasonCode = this.data.feedbackReason || ''
    const feedbackEvent = {
      eventId: `product-feedback-${Date.now()}`,
      targetType: 'result',
      targetId: 'overall',
      value,
      reasonCode,
      createdAt: Date.now(),
      contentVersion: CONTENT_VERSION,
      questionnaireVersion: questionnaireVersionForReport(this.data.report)
    }
    recordEvent('assessment_feedback', {
      targetType: 'result',
      targetId: 'overall',
      value,
      reasonCode
    })
    const report = this.data.report
    if (this.mode !== 'product-v0' || !report || !report._id || !cloud.isCloudReady()) return this.setData({ feedbackSubmitted: true, feedbackSyncing: false, feedbackSyncError: '' })
    this._feedbackInFlight = true
    this.setData({ feedbackSyncing: true, feedbackSyncError: '' })
    cloud.appendAssessmentFeedbackToCloud(report._id, feedbackEvent, {
      success: () => {
        this._feedbackInFlight = false
        this.setData({ feedbackSubmitted: true, feedbackSyncing: false, feedbackSyncError: '' })
      },
      fail: error => {
        this._feedbackInFlight = false
        this.setData({ feedbackSubmitted: false, feedbackSyncing: false, feedbackSyncError: cloud.cloudErrorMessage(error) })
      }
    })
  },

  skipFeedback() {
    if (this.data.feedbackSubmitted) return
    recordEvent('assessment_feedback_skip', { targetType: 'result', targetId: 'overall' })
    this.setData({ feedbackSubmitted: true })
  },

  restart() {
    if (this.mode === 'product-v0') {
      const restart = () => {
        if (this._restarting) return
        this._restarting = true
        this.beginProductMutation()
        if (!cloud.isCloudReady()) {
          productStore.resetSession()
          this.endProductMutation()
          return navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-v3/index' })
        }
        this.setData({ syncing: true, syncError: '' })
        cloud.deleteProductV0FromCloud({
          success: () => { productStore.resetSession(); this.endProductMutation(); navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-v3/index' }) },
          fail: error => { this.endProductMutation(); this._restarting = false; this.setData({ syncing: false, syncError: cloud.cloudErrorMessage(error) }) }
        })
      }
      if (typeof wx !== 'undefined' && typeof wx.showModal === 'function') return wx.showModal({ title: PRODUCT_V0_COPY.preview.restartDialogTitle, content: PRODUCT_V0_COPY.preview.restartDialogContent, confirmText: PRODUCT_V0_COPY.preview.restartConfirm, cancelText: PRODUCT_V0_COPY.preview.deleteCancel, success: result => { if (result.confirm) restart() } })
      return restart()
    }
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  requestDelete() {
    if (this.mode !== 'product-v0' || this._deleting) return
    const remove = () => {
      productStore.resetSession()
      this.endProductMutation()
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    }
    const startRemove = () => {
      this._deleting = true
      this.beginProductMutation()
      this.setData({ syncing: true, syncError: '' })
      if (typeof wx === 'undefined' || !cloud.isCloudReady()) return remove()
      cloud.deleteProductV0FromCloud({
        success: remove,
        fail: error => { this._deleting = false; this.endProductMutation(); this.setData({ syncing: false, syncError: cloud.cloudErrorMessage(error) }) }
      })
    }
    if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') return startRemove()
    wx.showModal({ title: PRODUCT_V0_COPY.preview.deleteDialogTitle, content: PRODUCT_V0_COPY.preview.deleteDialogContent, confirmText: PRODUCT_V0_COPY.preview.deleteConfirm, cancelText: PRODUCT_V0_COPY.preview.deleteCancel, success: result => {
      if (!result.confirm) return
      startRemove()
    } })
  },

  startAtFirstChapter() {
    if (this.mode === 'product-v0') return this.openAnswerReview()
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.personaId)}&chapter=C1` })
  }
})

module.exports = { chapterViews, journeySectionViews, replaceTemplate, productResultUrl, decorateProductReport, updateTargetViews, questionnaireVersionForReport }
