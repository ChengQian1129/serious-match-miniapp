const { getReport } = require('../../utils/assessment-v2/session-store')
const { CHAPTERS } = require('../../utils/assessment-v2/questionnaire-definitions')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { recordEvent } = require('../../utils/storage')
const evidenceCopy = require('../../shared/content/evidence-copy')

function relatedItemIds(claim) {
  return [].concat(claim.supportingItemIds || [], claim.contradictingItemIds || [], claim.qualifyingItemIds || [])
}

function revisionUrl(claim) {
  const itemId = relatedItemIds(claim)[0]
  const chapter = CHAPTERS.find(candidate => candidate.itemIds.includes(itemId)) || CHAPTERS[0]
  const question = Math.max(0, chapter.itemIds.indexOf(itemId))
  return `/pages/questionnaire/index?chapter=${chapter.id}&question=${question}&revise=1`
}

function evidenceGroups(claim) {
  const evidence = claim.evidence || {}
  return [
    { id: 'supporting', label: '这个结论主要参考了这些回答', items: evidence.supporting || [] },
    { id: 'contradicting', label: '还有这些回答需要一起看', items: evidence.contradicting || [] },
    { id: 'qualifying', label: '这些回答让结论保留一点空间', items: evidence.qualifying || [] }
  ].filter(group => group.items.length)
}

Page({
  data: {
    claim: null,
    evidenceExpanded: false,
    evidenceGroups: [],
    evidenceCopy,
    reviseUrl: '/pages/questionnaire/index?chapter=C1&question=0&revise=1'
  },

  onLoad(query) { this.claimId = decodeURIComponent(query.id || '') },

  onShow() {
    resetNavigation(this)
    const report = getReport()
    const claim = report && report.claims.find(item => item.id === this.claimId)
    if (!claim) return navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' })
    this.setData({
      claim,
      evidenceExpanded: false,
      evidenceGroups: evidenceGroups(claim),
      reviseUrl: revisionUrl(claim)
    })
    recordEvent('report_claim_open', { claimId: this.claimId })
  },

  toggleEvidence() {
    this.setData({ evidenceExpanded: !this.data.evidenceExpanded })
  },

  reviseAnswer() {
    recordEvent('report_revise', { claimId: this.claimId })
    navigateOnce(this, 'redirectTo', { url: this.data.reviseUrl })
  },

  returnReport() {
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' }) })
  }
})

module.exports = { evidenceGroups, revisionUrl }
