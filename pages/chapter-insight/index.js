const { CHAPTERS, ITEMS, getChapter } = require('../../utils/assessment-v2/questionnaire-definitions')
const { getSession, saveChapterInsightFeedback, shouldSyncAssessment, completeAssessment } = require('../../utils/assessment-v2/session-store')
const { saveAssessmentDraftToCloud } = require('../../utils/cloud')
const { buildChapterInsight } = require('../../utils/assessment-v2/chapter-insight-engine')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')
const evidenceCopy = require('../../shared/content/evidence-copy')

Page({
  data: { statusBarHeight: getStatusBarHeight(), chapter: null, insight: null, nextChapter: null, selectedFeedback: '', evidenceExpanded: false, evidenceCopy, feedbackOptions: evidenceCopy.feedbackOptions },
  onLoad(query) {
    this.chapterId = query.chapter || 'C1'
    const chapter = getChapter(this.chapterId)
    const session = getSession()
    if (!chapter) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    const index = CHAPTERS.findIndex(item => item.id === this.chapterId)
    const savedFeedback = session.chapterFeedback && session.chapterFeedback[this.chapterId]
    this.setData({ chapter, insight: buildChapterInsight(this.chapterId, session.answers), nextChapter: CHAPTERS[index + 1] || null, selectedFeedback: savedFeedback ? savedFeedback.value : '', evidenceExpanded: false })
    recordEvent('chapter_insight_view', { chapterId: this.chapterId })
  },
  onShow() { resetNavigation(this) },
  chooseFeedback(event) {
    const value = event.currentTarget.dataset.value
    try {
      const session = saveChapterInsightFeedback(this.chapterId, value)
      this.setData({ selectedFeedback: value })
      recordEvent('chapter_insight_feedback', { chapterId: this.chapterId, value })
      if (shouldSyncAssessment()) saveAssessmentDraftToCloud(session, {})
    } catch (error) { wx.showToast({ title: error.message || '暂时无法记录', icon: 'none' }) }
  },
  toggleEvidence() {
    const expanded = !this.data.evidenceExpanded
    this.setData({ evidenceExpanded: expanded })
    if (expanded) recordEvent('chapter_evidence_expand', { chapterId: this.chapterId })
  },
  continueNext() {
    try {
      const session = getSession()
      const allAnswered = ITEMS.every(item => item.id in session.answers)
      if (this.data.nextChapter && !(session.revisionPending && allAnswered)) return navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire/index?chapter=${this.data.nextChapter.id}&question=0` })
      if (!allAnswered) throw new Error('关系说明书还有未完成的题目')
      completeAssessment()
      navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire-result/index' })
    } catch (error) { wx.showToast({ title: error.message || '请完成全部章节', icon: 'none' }) }
  },
  backHome() { navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) }
})
