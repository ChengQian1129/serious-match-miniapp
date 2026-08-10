const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const normative = require('./sync-assessment-v3-product')
const app = require('../app.json')
const { FEATURES } = require('../utils/features')
const { DIMENSION_IDS, CHAPTERS } = require('../shared/assessment-v3-product/contract')
const { listFixtures } = require('../shared/assessment-v3-product/fixtures')
const { buildReport } = require('../shared/assessment-v3-product/report-renderer')
const { derivePatternEligibility, evaluatePattern } = require('../shared/assessment-v3-product/pattern-eligibility')

const root = path.resolve(__dirname, '..')
assert.equal(fs.readFileSync(normative.outputPath, 'utf8'), normative.render(normative.buildBundle()), 'generated V3 product normative bundle is stale; run npm run sync:assessment-v3-product')
const routes = [
  'pages/v3-product-preview/index',
  'pages/v3-checkpoint/index',
  'pages/v3-result/index',
  'pages/v3-result-evidence/index'
]

routes.forEach(route => {
  assert.ok(app.pages.includes(route), `${route} is not registered in app.json`)
  assert.ok(fs.existsSync(path.join(root, `${route}.js`)), `${route}.js is missing`)
  assert.ok(fs.existsSync(path.join(root, `${route}.wxml`)), `${route}.wxml is missing`)
})
assert.equal(FEATURES.v3ProductPreview, true)
assert.equal(FEATURES.v3CalibratedProduction, false)
assert.equal(listFixtures().length >= 12, true)

listFixtures().forEach(fixture => {
  const report = buildReport(fixture)
  assert.equal(report.source, 'synthetic_fixture')
  assert.equal(report.isSynthetic, true)
  assert.deepEqual(report.dimensionCards.map(card => card.id), DIMENSION_IDS)
  assert.deepEqual(report.chapterSyntheses.map(chapter => chapter.id), CHAPTERS.map(chapter => chapter.id))
  assert.deepEqual(report.decisionMap.sections.map(section => section.id), ['l3', 'l4', 'l5'])
  assert.ok(report.executiveSummary.patterns.length <= 3)
  const eligibility = new Map(derivePatternEligibility(fixture).map(item => [item.patternId, item]))
  report.executiveSummary.patterns.forEach(pattern => assert.equal(eligibility.get(pattern.id).eligible, true, `${fixture.persona.id}: ineligible pattern ${pattern.id}`))
  ;(fixture.expectedPatternIds || []).forEach(patternId => assert.equal(evaluatePattern(fixture, patternId).eligible, true, `${fixture.persona.id}: expected pattern ${patternId} is ineligible`))
  const c3 = report.chapterSyntheses.find(chapter => chapter.id === 'C3')
  const regulationCard = report.dimensionCards.find(card => card.id === 'uncertainty_regulation')
  assert.notEqual(c3.headline, regulationCard.headline)
  report.dimensionCards.forEach(card => card.evidence.forEach(item => {
    assert.ok(item.question)
    assert.ok(item.answer)
    assert.ok(item.label)
  }))
  ;['score', 'totalScore', 'compatibility', 'personalityType'].forEach(key => assert.equal(Object.prototype.hasOwnProperty.call(report, key), false))
})

const rendererSource = fs.readFileSync(path.join(root, 'shared/assessment-v3-product/report-renderer.js'), 'utf8')
assert.equal(/[\u4e00-\u9fff]/u.test(rendererSource), false, 'Product renderer must not define inline public Chinese copy')
const pilotRuntime = fs.readFileSync(path.join(root, 'shared/assessment-v3-pilot/runtime-engine.js'), 'utf8')
assert.equal(pilotRuntime.includes('node:crypto'), false)
assert.ok(fs.readFileSync(path.join(root, 'utils/assessment-v3-pilot/session-store.js'), 'utf8').includes('completed_no_scoring'))

console.log(`assessment-v3-product checks OK: ${listFixtures().length} synthetic personas, ${DIMENSION_IDS.length} dimensions, ${CHAPTERS.length} chapters`)
