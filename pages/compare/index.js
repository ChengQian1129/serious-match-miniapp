const { getReport, getSession, replaceReport, replaceSession, setStorageChoice } = require('../../utils/assessment-v2/session-store')
const { completeAssessmentToCloud, createCompareInvite, joinCompareInvite, getCompareInvite, cloudErrorMessage } = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

const DIMENSION_LABELS = {
  response_predictability: '重要回应是否有下文',
  emotional_support: '情绪支持的方式',
  autonomy_space: '亲密与个人空间',
  conflict_pause: '分歧时怎样暂停',
  repair_reengagement: '冲突后怎样回来'
}

Page({
  data: { mode: 'create', code: '', expiresText: '', comparison: null, aligned: [], discuss: [], isLoading: false, error: '' },
  onLoad(query) { const code = String(query.code || '').trim().toUpperCase(); this.setData({ code, mode: code ? 'join' : 'create' }) },
  onShow() { resetNavigation(this) },
  ensureCloudReport(callback) {
    const report = getReport()
    if (!report) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    if (report._id) return callback(report)
    completeAssessmentToCloud(getSession(), {
      success: data => {
        if (data.session) replaceSession(data.session)
        const cloudReport = data.report ? replaceReport(data.report) : getReport()
        setStorageChoice('cloud')
        callback(cloudReport)
      },
      fail: error => this.setData({ isLoading: false, error: cloudErrorMessage(error) })
    })
  },
  createInvite() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true, error: '' })
    this.ensureCloudReport(report => createCompareInvite(report._id, {
      success: data => this.setData({ isLoading: false, mode: 'invite', code: data.code, expiresText: '邀请 7 天内有效' }),
      fail: error => this.setData({ isLoading: false, error: cloudErrorMessage(error) })
    }))
  },
  joinInvite() {
    if (this.data.isLoading || !this.data.code) return
    this.setData({ isLoading: true, error: '' })
    this.ensureCloudReport(report => joinCompareInvite(this.data.code, report._id, {
      success: data => this.showComparison(data.comparison),
      fail: error => this.setData({ isLoading: false, error: cloudErrorMessage(error) })
    }))
  },
  refreshComparison() {
    if (this.data.isLoading || !this.data.code) return
    this.setData({ isLoading: true, error: '' })
    getCompareInvite(this.data.code, { success: data => this.showComparison(data.comparison), fail: error => this.setData({ isLoading: false, error: cloudErrorMessage(error) }) })
  },
  showComparison(comparison) {
    this.setData({ isLoading: false, mode: 'result', comparison, aligned: (comparison.aligned || []).map(id => DIMENSION_LABELS[id] || id), discuss: (comparison.discuss || []).map(id => DIMENSION_LABELS[id] || id) })
  },
  backReport() { navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' }) }) },
  onShareAppMessage() { return { title: '和我一起看看我们的关系线索', path: `/pages/compare/index?code=${this.data.code}` } }
})
