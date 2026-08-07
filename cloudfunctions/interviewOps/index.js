const core = require('./core')

const ACTIONS = new Set([
  "participantSearch",
  "participantDetail",
  "participantContactReveal",
  "caseCreate",
  "caseGet",
  "caseUpdateStatus",
  "preparationGenerate",
  "independentObservationAppend",
  "caseReveal",
  "validationAppend",
  "questionUnderstandingAppend",
  "validationList",
  "deidentifiedExport",
  "pilotMetrics"
])

exports.main = async event => {
  if (!event || !ACTIONS.has(event.action)) return { ok: false, code: 'UNKNOWN_ACTION', message: '不支持的操作' }
  return core.main(event)
}
