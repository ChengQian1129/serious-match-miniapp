const { CHAPTERS, ITEMS, getChapter } = require('../../utils/assessment-v2/questionnaire-definitions')
const { getSession, completeAssessment } = require('../../utils/assessment-v2/session-store')
const { buildChapterInsight } = require('../../utils/assessment-v2/chapter-insight-engine')
const { getStatusBarHeight } = require('../../utils/window')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')
const evidenceCopy = require('../../shared/content/evidence-copy')
const { classifyError } = require('../../shared/content/public-errors')

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    chapterNumber: 1,
    chapter: null,
    insight: null,
    nextChapter: null,
    evidenceExpanded: false,
    evidenceCopy
  },

  onLoad(query) {
    this.chapterId = query.chapter || 'C1'
    const chapter = getChapter(this.chapterId)
    const session = getSession()
    if (!chapter) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    const index = CHAPTERS.findIndex(item => item.id === this.chapterId)
    this.setData({
      chapterNumber: index + 1,
      chapter,
      insight: buildChapterInsight(this.chapterId, session.answers),
      nextChapter: CHAPTERS[index + 1] || null,
      evidenceExpanded: false
    })
    recordEvent('chapter_insight_view', { chapterId: this.chapterId })
  },

  onShow() { resetNavigation(this) },

  toggleEvidence() {
    const expanded = !this.data.evidenceExpanded
    this.setData({ evidenceExpanded: expanded })
    if (expanded) recordEvent('chapter_evidence_expand', { chapterId: this.chapterId })
  },

  continueNext() {
    try {
      const session = getSession()
      const allAnswered = ITEMS.every(item => item.id in session.answers)
      if (this.data.nextChapter && !(session.revisionPending && allAnswered)) {
        return navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire/index?chapter=${this.data.nextChapter.id}&question=0` })
      }
      if (!allAnswered) throw new Error('还有题没答完。')
      completeAssessment()
      navigateOnce(this, 'redirectTo', { url: '/pages/questionnaire-result/index' })
    } catch (error) {
      wx.showToast({ title: classifyError(error, 'incomplete'), icon: 'none' })
    }
  },

  reviewChapter() {
    navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire/index?chapter=${this.chapterId}&question=7&direction=back` })
  },

  backHome() { navigateOnce(this, 'reLaunch', { url: '/pages/home/index' }) }
})
