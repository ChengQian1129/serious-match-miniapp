const HYPOTHESIS_RULE_VERSION = 'serious-match-interview-rules-1.0.0'

const TOPICS = Object.freeze({
  overall: '当前关系意愿与现实余力',
  interaction: '亲密互动与关系不确定性',
  resource: '沟通与修复资源',
  provide: '通常能够提供的关系资源',
  tension: '回答中需要核对的拉扯',
  observation: '压力情境下的实际动作'
})

const GENERAL_GUIDE_TOPICS = Object.freeze([
  '当前关系意愿与现实余力',
  '面对关系不确定时的实际反应',
  '亲近、依赖与个人空间',
  '希望获得和通常能够提供的支持',
  '冲突暂停与重新修复的真实经历'
])

function evidence(claim, kind, fallbackKey) {
  const values = claim && claim.evidence && claim.evidence[kind]
  if (Array.isArray(values)) return values
  return (claim && claim[fallbackKey] || []).map(itemId => ({ itemId, kind }))
}

function feedbackFor(reportSnapshot, claimId) {
  return reportSnapshot && reportSnapshot.userConfirmations && reportSnapshot.userConfirmations[claimId] || null
}

function priorityFor(claim, feedback) {
  if (feedback && feedback.value === 'does_not_fit') return 'high'
  if (claim.section === 'tension' || evidence(claim, 'contradicting', 'contradictingItemIds').length) return 'high'
  if (feedback && feedback.value === 'partly_fits') return 'medium'
  return claim.confidence && ['tentative', 'context_dependent'].includes(claim.confidence.level) ? 'medium' : 'normal'
}

function hypothesisFromClaim(claim, reportSnapshot) {
  const feedback = feedbackFor(reportSnapshot, claim.id)
  return {
    hypothesisId: `HYP_${claim.id}`,
    sourceClaimIds: [claim.id],
    topic: TOPICS[claim.section] || '关系经验核对',
    hypothesis: claim.statement || claim.text || claim.title,
    confidence: claim.confidence || { level: 'tentative', reasonCodes: [] },
    supportingEvidence: evidence(claim, 'supporting', 'supportingItemIds'),
    contradictingEvidence: evidence(claim, 'contradicting', 'contradictingItemIds'),
    qualifyingEvidence: evidence(claim, 'qualifying', 'qualifyingItemIds'),
    alternativeExplanations: claim.alternativeExplanations || [],
    missingEvidence: evidence(claim, 'missing', 'missingItemIds'),
    suggestedQuestions: claim.verificationQuestions || [],
    userFeedback: feedback,
    interviewPriority: priorityFor(claim, feedback),
    ruleVersion: HYPOTHESIS_RULE_VERSION
  }
}

function factRows(participantSnapshot) {
  const source = participantSnapshot || {}
  return [
    ['所在区域', source.cityArea],
    ['合适联系时间', source.availability],
    ['愿意参与', Array.isArray(source.participationTypes) ? source.participationTypes.join('、') : '']
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }))
}

function buildInterviewPreparation(reportSnapshot, participantSnapshot, generatedAt = Date.now()) {
  const report = reportSnapshot || {}
  const candidates = Array.isArray(report.allClaimCandidates) && report.allClaimCandidates.length ? report.allClaimCandidates : report.claims || []
  const priorityOrder = { high: 0, medium: 1, normal: 2 }
  const hypotheses = candidates.map(claim => hypothesisFromClaim(claim, report)).sort((left, right) => priorityOrder[left.interviewPriority] - priorityOrder[right.interviewPriority])
  const confirmations = report.userConfirmations || {}
  const confirmedClaims = candidates.filter(claim => confirmations[claim.id] && ['fits', 'partly_fits'].includes(confirmations[claim.id].value)).map(claim => ({ claimId: claim.id, title: claim.title, value: confirmations[claim.id].value, note: confirmations[claim.id].note || '', context: confirmations[claim.id].context || '' }))
  const rejectedClaims = candidates.filter(claim => confirmations[claim.id] && confirmations[claim.id].value === 'does_not_fit').map(claim => ({ claimId: claim.id, title: claim.title, note: confirmations[claim.id].note || '', context: confirmations[claim.id].context || '' }))
  const informationGaps = (report.unknowns || []).map(item => ({ type: 'unknown', id: item.id, title: item.title, detail: item.text })).concat(hypotheses.filter(item => item.missingEvidence.length).map(item => ({ type: 'missing_evidence', id: item.hypothesisId, title: item.topic, itemIds: item.missingEvidence.map(evidenceItem => evidenceItem.itemId) }))).concat(rejectedClaims.map(item => ({ type: 'user_rejected_claim', id: item.claimId, title: item.title, detail: item.note })))
  const facts = factRows(participantSnapshot)
  return {
    generatedAt,
    instrumentVersion: report.instrumentVersion,
    scoringRuleVersion: report.scoringRuleVersion,
    reportRuleVersion: report.reportRuleVersion,
    hypothesisRuleVersion: HYPOTHESIS_RULE_VERSION,
    overview: {
      facts,
      currentRelationshipClaims: candidates.filter(claim => claim.section === 'overall').map(claim => ({ claimId: claim.id, title: claim.title })),
      confirmedClaims,
      rejectedClaims
    },
    phaseOne: {
      mode: 'relative_blind',
      facts,
      guideTopics: GENERAL_GUIDE_TOPICS,
      instruction: '先根据真实经历独立记录，不查看系统假设。'
    },
    phaseTwo: {
      mode: 'model_assisted_review',
      hypotheses,
      reviewPrompts: ['哪些假设自然出现？', '哪些结论被推翻或依赖情境？', '系统遗漏了哪些重要主题？', '哪些问题真正节省了基础询问？']
    },
    hypotheses,
    avoidRepeatingFacts: facts,
    informationGaps
  }
}

module.exports = { HYPOTHESIS_RULE_VERSION, TOPICS, GENERAL_GUIDE_TOPICS, hypothesisFromClaim, buildInterviewPreparation }
