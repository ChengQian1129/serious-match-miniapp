const { getReport } = require('../../utils/assessment-v2/session-store')
const { getProfile, hasProfile, recordEvent } = require('../../utils/storage')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

function profileFacts(profile) {
  if (!profile || !profile.createdAt) return []
  const facts = []
  if (profile.about && profile.about.displayName) facts.push({ id: 'name', label: '称呼', text: profile.about.displayName })
  if (profile.basic && profile.basic.district) facts.push({ id: 'district', label: '生活区域', text: '已填写' })
  if (profile.relationship && profile.relationship.goal) facts.push({ id: 'goal', label: '关系方向', text: '已填写' })
  return facts
}

const SECTION_LABELS = { overall: '当前关系状态', interaction: '靠近与不确定', resource: '安全与回应', provide: '需要与提供', tension: '冲突与修复', observation: '认识新的人时' }

Page({
  data: { report: null, claims: [], groups: [], confirmed: [], unknowns: [], facts: [], hasSavedProfile: false },
  onShow() {
    resetNavigation(this)
    const report = getReport()
    if (!report) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    const confirmations = report.userConfirmations || {}
    const groups = Object.keys(SECTION_LABELS).map(id => ({ id, title: SECTION_LABELS[id], claims: report.claims.filter(claim => claim.section === id) })).filter(group => group.claims.length)
    this.setData({ report, claims: report.claims, groups, confirmed: report.claims.filter(claim => confirmations[claim.id] && ['fits', 'partly_fits'].includes(confirmations[claim.id].value)), unknowns: report.unknowns, facts: profileFacts(getProfile()), hasSavedProfile: hasProfile() })
    recordEvent('relationship_map_v2_view')
  },
  openClaim(event) { navigateOnce(this, 'navigateTo', { url: `/pages/record-claim/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }) },
  openReport() { navigateOnce(this, 'navigateTo', { url: '/pages/questionnaire-result/index' }) },
  openProfile() { navigateOnce(this, 'navigateTo', { url: this.data.hasSavedProfile ? '/pages/profile/index' : '/pages/onboarding-basic/index' }) }
})
