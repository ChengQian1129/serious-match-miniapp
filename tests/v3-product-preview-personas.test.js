const assert = require('node:assert/strict')
const { listFixtures } = require('../shared/assessment-v3-product/fixtures')
const { buildReport, buildChapterView, buildEvidenceView } = require('../shared/assessment-v3-product/report-renderer')

const fixtures = listFixtures()
assert.equal(fixtures.length, 12)
fixtures.forEach(fixture => {
  const report = buildReport(fixture)
  report.chapterSyntheses.forEach(chapter => {
    const view = buildChapterView(report, chapter.id)
    assert.equal(view.dimensionCards.length, chapter.dimensionIds.length)
    view.dimensionCards.forEach(card => {
      const evidence = buildEvidenceView(report, card.id)
      assert.equal(evidence.title, card.title)
      if (card.evidenceAvailable) assert.ok(evidence.evidence.every(item => item.question && item.answer))
      if (card.evidenceAvailable) assert.ok(evidence.evidence.every(item => item.label))
    })
  })
})

console.log('V3 product personas OK: all 12 fixtures walk through checkpoints and evidence')
