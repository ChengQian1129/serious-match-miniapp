const { CHAPTERS, ITEMS, getChapter } = require('../../utils/assessment-v2/questionnaire-definitions')
const { getSession, saveChapterInsightFeedback, shouldSyncAssessment, completeAssessment, replaceSession, replaceReport } = require('../../utils/assessment-v2/session-store')
const { saveAssessmentDraftToCloud, completeAssessmentToCloud } = require('../../utils/cloud')
const { buildChapterInsight } = require('../../utils/assessment-v2/chapter-insight-engine')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')

Page({
  data: { statusBarHeight: getStatusBarHeight(), chapter: null, insight: null, nextChapter: null, selectedFeedback: '', evidenceExpanded: false, feedbackOptions: [{ value: 'fits', label: '符合' }, { value: 'partly_fits', label: '部分符合' }, { value: 'does_not_fit', label: '不符合' }, { value: 'unsure', label: '暂不确定' }] },
  onLoad(query) {
    this.chapterId = query.chapter || 'C1'
    const chapter = getChapter(this.chapterId)
    const session = getSession()
    if (!chapter) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    const index = CHAPTERS.findIndex(item => item.id === this.chapterId)
    const savedFeedback = session.chapterFeedback && session.chapterFeedback[this.chapterId]
    this.setData({ chapter, insight: buildChapterInsight(this.chapterId, session.answers), nextChapter: CHAPTERS[index + 1] || null, selectedFeedback: savedFeedback ? savedFeedback.value : '', evidenceExpanded: false })
    recordEvent('assessment_v2_chapter_insight_view', { chapterId: this.chapterId })
  },
  onShow() { resetNavigation(this) },
  chooseFeedback(event) {
    const value = event.currentTarget.dataset.value
    try {
      const session = saveChapterInsightFeedback(this.chapterId, value)
      this.setData({ selectedFeedback: value })
      if (shouldSyncAssessment()) saveAssessmentDraftToCloud(session, {})
    } catch (error) { wx.showToast({ title: error.message || '暂时无法记录', icon: 'none' }) }
  },
  toggleEvidence() { this.setData({ evidenceExpanded: !this.data.evidenceExpanded }) },
  continueNext() {
    try {
      const session = getSession()
      const allAnswered = ITEMS.every(item => item.id in session.answers)
      if (this.data.nextChapter && !(session.revisionPending && allAnswered)) return navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire/index?chapter=${this.data.nextChapter.id}&question=0` })
      if (!allAnswered) throw new Error('关系说明书还有未完成的题目')
      const completed = completeAssessment()
      if (shouldSyncAssessment()) completeAssessmentToCloud(completed.session, { success: data => { if (data.session) replaceSession(data.session); if (data.report) replaceReport(data.report) }, fail: () => recordEvent('assessment_v2_report_sync_failed') })
      navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire-result/index' })
    } catch (error) { wx.showToast({ title: error.message || '请完成全部章节', icon: 'none' }) }
  },
  backHome() { navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) }
})
