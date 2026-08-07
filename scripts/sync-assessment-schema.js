const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'shared/assessment/schema.js')
const text = fs.readFileSync(source, 'utf8')
const targets = [
  path.join(root, 'utils/assessment-v2/generated/questionnaire-definitions.js'),
  path.join(root, 'cloudfunctions/datingProfile/assessment-v2-questionnaire-definitions.generated.js')
]
targets.forEach(target => {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, text)
})
const scoringSource = fs.readFileSync(path.join(root, 'shared/assessment/scoring-rules.js'), 'utf8')
const scoringTargets = [
  [path.join(root, 'utils/assessment-v2/generated/scoring-rules.js'), scoringSource.replace("require('./schema')", "require('../questionnaire-definitions')")],
  [path.join(root, 'cloudfunctions/datingProfile/assessment-v2-scoring-rules.generated.js'), scoringSource.replace("require('./schema')", "require('./assessment-v2-questionnaire-definitions')")]
]
const reportRules = fs.readFileSync(path.join(root, 'shared/assessment/report-rules.js'), 'utf8')
const ruleTargets = [
  [path.join(root, 'utils/assessment-v2/generated/report-rules.js'), reportRules],
  [path.join(root, 'cloudfunctions/datingProfile/assessment-v2-report-rules.generated.js'), reportRules]
]
scoringTargets.concat(ruleTargets).forEach(([target, content]) => {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
})
const digest = crypto.createHash('sha256').update(text).digest('hex')
const metadata = JSON.stringify({ source: 'shared/assessment/schema.js', sha256: digest, instrumentVersion: '2.1.0-pilot' }, null, 2) + '\n'
fs.writeFileSync(path.join(root, 'shared/assessment/schema.manifest.json'), metadata)
console.log('Assessment schema synced:', digest)
