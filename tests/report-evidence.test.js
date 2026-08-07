const assert = require('node:assert/strict')
const { ITEMS } = require('../utils/assessment-v2/questionnaire-definitions')
const { buildReport } = require('../utils/assessment-v2/report-engine')

const answers = Object.fromEntries(ITEMS.map(item => [item.id, 3]))
;['RIN01', 'RIN02', 'RIN04'].forEach(id => { answers[id] = 5 })
answers.RIN03 = 1
answers.RMV01 = 5
answers.RMV02 = 5
answers.RMV03 = 5
answers.RMV04 = 3
const report = buildReport(answers, { generatedAt: 100, responseQuality: { status: 'normal' } })
const motivation = report.allClaimCandidates.find(claim => claim.id === 'COMB_MOTIVATION_01')
assert.ok(motivation)
assert.ok(motivation.evidence.supporting.length > 0)
assert.ok(motivation.evidence.contradicting.length > 0)
assert.ok(motivation.evidence.qualifying.length > 0)
assert.equal(motivation.evidence.supporting.some(item => item.itemId === 'RMV01'), false)
assert.equal(motivation.confidence.level, 'context_dependent')
assert.ok(motivation.alternativeExplanations.length)
assert.ok(motivation.verificationQuestions.length)
assert.ok(report.visibleClaimIds.includes(motivation.id))

const sparse = buildReport({ RIN01: 5, RIN02: 5 }, { responseQuality: { status: 'limited_evidence' } })
assert.ok(sparse.unknowns.length)
assert.ok(sparse.claims.every(claim => claim.confidence.level !== 'strong'))
console.log('Report evidence OK: selectors separate support, contradiction, qualification, and unknowns')
