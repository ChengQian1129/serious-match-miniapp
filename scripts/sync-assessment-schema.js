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
const reportEngine = fs.readFileSync(path.join(root, 'shared/assessment/report-engine.js'), 'utf8')
const claimCopy = fs.readFileSync(path.join(root, 'shared/content/claim-copy.js'), 'utf8')
const interviewRules = fs.readFileSync(path.join(root, 'shared/assessment/interview-rules.js'), 'utf8')
const contentVersions = require(path.join(root, 'shared/content/version.js'))
const publicLanguage = require(path.join(root, 'shared/content/public-language.generated.js'))
const cloudContentVersion = `const CONTENT_VERSION = ${JSON.stringify(contentVersions.CONTENT_VERSION)}\nconst REPORT_COPY_VERSION = ${JSON.stringify(contentVersions.REPORT_COPY_VERSION)}`
const cloudPublicLanguage = `const publicLanguage = { v2: { reportFallback: { unknownText: ${JSON.stringify(publicLanguage.v2.reportFallback.unknownText)} } } }`
const ruleTargets = [
  [path.join(root, 'utils/assessment-v2/generated/report-rules.js'), reportRules],
  [path.join(root, 'cloudfunctions/datingProfile/assessment-v2-report-rules.generated.js'), reportRules]
]
const engineTargets = [
  [path.join(root, 'utils/assessment-v2/generated/report-engine.js'), reportEngine.replaceAll("require('./schema')", "require('./questionnaire-definitions')").replace("require('../content/version')", "require('../../../shared/content/version')").replace("require('../content/claim-copy')", "require('../../../shared/content/claim-copy')").replace("require('../content/public-language.generated')", "require('../../../shared/content/public-language.generated')")],
  [path.join(root, 'cloudfunctions/datingProfile/assessment-v2-report-engine.generated.js'), reportEngine.replaceAll("require('./schema')", "require('./assessment-v2-questionnaire-definitions')").replaceAll("require('./scoring-rules')", "require('./assessment-v2-scoring-engine')").replaceAll("require('./report-rules')", "require('./assessment-v2-report-rules')").replace("const { CONTENT_VERSION, REPORT_COPY_VERSION } = require('../content/version')", cloudContentVersion).replace("require('../content/claim-copy')", "require('./assessment-v2-claim-copy.generated')").replace("const publicLanguage = require('../content/public-language.generated')", cloudPublicLanguage)],
  [path.join(root, 'cloudfunctions/datingProfile/assessment-v2-claim-copy.generated.js'), claimCopy]
]
const interviewTargets = [
  [path.join(root, 'cloudfunctions/datingProfile/assessment-v2-interview-rules.generated.js'), interviewRules.replace("const { HYPOTHESIS_RULE_VERSION } = require('./version')", "const HYPOTHESIS_RULE_VERSION = 'serious-match-interview-rules-1.0.0'")]
]
scoringTargets.concat(ruleTargets, engineTargets, interviewTargets).forEach(([target, content]) => {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
})
const digest = crypto.createHash('sha256').update(text).digest('hex')
const metadata = JSON.stringify({ source: 'shared/assessment/schema.js', sha256: digest, instrumentVersion: '2.1.1-pilot' }, null, 2) + '\n'
fs.writeFileSync(path.join(root, 'shared/assessment/schema.manifest.json'), metadata)
console.log('Assessment schema synced:', digest)
