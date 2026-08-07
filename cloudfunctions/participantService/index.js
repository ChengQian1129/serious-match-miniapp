const core = require('./core')

const ACTIONS = new Set([
  "consentGrant",
  "consentRevoke",
  "consentList",
  "participantUpsert",
  "participantGet",
  "participantDelete"
])

exports.main = async event => {
  if (!event || !ACTIONS.has(event.action)) return { ok: false, code: 'UNKNOWN_ACTION', message: '不支持的操作' }
  return core.main(event)
}
