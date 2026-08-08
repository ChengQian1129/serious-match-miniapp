const { getReport, shouldSyncAssessment } = require('../../utils/assessment-v2/session-store')
const { isCloudReady, getAssessmentHistoryFromCloud } = require('../../utils/cloud')
const { recordEvent } = require('../../utils/storage')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { FEATURES } = require('../../utils/features')
const reportCopy = require('../../shared/content/report-copy')

function reportGroups(report) {
  const confirmations = report.userConfirmations || {}
  return Object.keys(SECTION_LABELS).map(id => ({
    id,
    title: SECTION_LABELS[id],
    claims: report.claims.filter(claim => claim.section === id).map(claim => Object.assign({}, claim, {
      mapLabel: confirmations[claim.id] ? '你自己核对过' : '可以继续想想',
      mapStatus: confirmations[claim.id] ? '这句话已经有你的回应' : '打开看看这句话怎么来的'
    }))
  })).filter(group => group.claims.length)
}

function versionDate(value) {
  if (!Number(value)) return ''
  const date = new Date(Number(value))
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

const SECTION_LABELS = { overall: '目前比较明显的', interaction: '关系一有变化时', resource: '你希望怎样相处', provide: '你通常能给出的', tension: '有几个地方值得多看一眼', observation: '还有一个动作值得注意' }

Page({
  data: { report: null, claims: [], groups: [], confirmed: [], unknowns: [], history: [], isViewingHistory: false, showFollowup: FEATURES.followupParticipation, copy: reportCopy.map },
  onShow() {
    resetNavigation(this)
    const report = getReport()
    if (!report) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    const confirmations = report.userConfirmations || {}
    this.currentReport = report
    this.showReport(report, false)
    if (!this._historyLoaded && shouldSyncAssessment() && isCloudReady()) {
      this._historyLoaded = true
      getAssessmentHistoryFromCloud({ success: data => {
        this._historyReports = data.reports || []
        this.setData({ history: this._historyReports.map(item => ({ id: item._id, version: item.reportVersion, title: item.title, date: versionDate(item.generatedAt), current: item._id === report._id })) })
      } })
    }
    recordEvent('relationship_map_v2_view')
  },
  showReport(report, isViewingHistory) {
    const confirmations = report.userConfirmations || {}
    this.setData({ report, claims: report.claims, groups: reportGroups(report), confirmed: report.claims.filter(claim => confirmations[claim.id] && ['fits', 'partly_fits'].includes(confirmations[claim.id].value)), unknowns: report.unknowns || [], isViewingHistory })
  },
  openHistory(event) {
    const report = (this._historyReports || []).find(item => item._id === event.currentTarget.dataset.id)
    if (report) this.showReport(report, report._id !== this.currentReport._id)
  },
  returnCurrent() { this.showReport(this.currentReport, false) },
  openClaim(event) {
    if (this.data.isViewingHistory) { wx.showToast({ title: '历史版本仅供查看', icon: 'none' }); return }
    navigateOnce(this, 'navigateTo', { url: `/pages/record-claim/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` })
  },
  openReport() { navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'navigateTo', { url: '/pages/questionnaire-result/index' }) }) },
  openFollowup() { recordEvent('followup_entry_view'); navigateOnce(this, 'navigateTo', { url: '/pages/followup-intro/index?returnTo=map' }) }
})
