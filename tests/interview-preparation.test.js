const assert = require('node:assert/strict')
const { buildInterviewPreparation, HYPOTHESIS_RULE_VERSION } = require('../shared/assessment/interview-rules')

const report = {
  instrumentVersion: '2.1.1-pilot',
  scoringRuleVersion: 'serious-match-scoring-2.1.0',
  reportRuleVersion: 'serious-match-report-rules-2.1.0',
  claims: [],
  allClaimCandidates: [{
    id: 'CLAIM_TEST',
    section: 'tension',
    title: '需要核对的拉扯',
    statement: '这是只能在第二阶段查看的模型假设。',
    confidence: { level: 'context_dependent', reasonCodes: ['contradicting_evidence'] },
    evidence: {
      supporting: [{ itemId: 'RIN01', answer: '比较符合' }],
      contradicting: [{ itemId: 'RIN02', answer: '不太符合' }],
      qualifying: [],
      missing: [{ itemId: 'RIN03', answer: '暂未判断' }]
    },
    alternativeExplanations: ['只在特定关系阶段出现'],
    verificationQuestions: ['最近一次实际发生了什么？']
  }],
  unknowns: [{ id: 'unknown-1', title: '暂时无法判断', text: '回答证据不足。' }],
  userConfirmations: { CLAIM_TEST: { value: 'does_not_fit', note: '我的真实经历不同。', context: '长期关系' } }
}

const preparation = buildInterviewPreparation(report, { cityArea: '大连', availability: '周末', participationTypes: ['interview'] }, 1234)
assert.equal(preparation.hypothesisRuleVersion, HYPOTHESIS_RULE_VERSION)
assert.equal(preparation.phaseOne.mode, 'relative_blind')
assert.equal(JSON.stringify(preparation.phaseOne).includes('模型假设'), false)
assert.equal(preparation.phaseTwo.hypotheses.length, 1)
assert.equal(preparation.hypotheses[0].interviewPriority, 'high')
assert.equal(preparation.hypotheses[0].contradictingEvidence[0].itemId, 'RIN02')
assert.equal(preparation.overview.rejectedClaims[0].claimId, 'CLAIM_TEST')
assert.ok(preparation.informationGaps.some(item => item.type === 'unknown'))
assert.ok(preparation.informationGaps.some(item => item.type === 'missing_evidence'))
assert.ok(preparation.informationGaps.some(item => item.type === 'user_rejected_claim'))
console.log('Interview preparation OK: blind phase, deterministic hypotheses, gaps, and priorities')
