const schema = require('./schema')
const versions = require('./version')

module.exports = Object.freeze({
  assessmentId: schema.ASSESSMENT_ID,
  instrumentVersion: versions.INSTRUMENT_VERSION,
  scoringRuleVersion: versions.SCORING_RULE_VERSION,
  reportRuleVersion: versions.REPORT_RULE_VERSION,
  hypothesisRuleVersion: versions.HYPOTHESIS_RULE_VERSION,
  itemCount: schema.ITEMS.length,
  chapterCount: schema.CHAPTERS.length
})
