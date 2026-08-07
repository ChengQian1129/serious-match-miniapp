const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'cloudfunctions/datingProfile')
const services = Object.freeze({
  assessmentService: [
    'assessmentSaveDraft',
    'assessmentComplete',
    'assessmentGet',
    'assessmentHistory',
    'assessmentDelete',
    'assessmentFeedbackAppend',
    'assessmentShareSettings'
  ],
  participantService: [
    'consentGrant',
    'consentRevoke',
    'consentList',
    'participantUpsert',
    'participantGet',
    'participantDelete'
  ],
  interviewOps: [
    'participantSearch',
    'participantDetail',
    'participantContactReveal',
    'caseCreate',
    'caseGet',
    'caseUpdateStatus',
    'preparationGenerate',
    'validationAppend',
    'questionUnderstandingAppend',
    'validationList',
    'deidentifiedExport',
    'pilotMetrics'
  ]
})

function wrapper(name, actions) {
  return `const core = require('./core')\n\nconst ACTIONS = new Set(${JSON.stringify(actions, null, 2)})\n\nexports.main = async event => {\n  if (!event || !ACTIONS.has(event.action)) return { ok: false, code: 'UNKNOWN_ACTION', message: '不支持的操作' }\n  return core.main(event)\n}\n`
}

function expectedFiles(name, actions) {
  const files = new Map([
    ['index.js', wrapper(name, actions)],
    ['core.js', fs.readFileSync(path.join(sourceDir, 'index.js'), 'utf8')],
    ['package.json', fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf8')]
  ])
  fs.readdirSync(sourceDir).filter(file => /^assessment-v2-.*\.js$/.test(file)).forEach(file => files.set(file, fs.readFileSync(path.join(sourceDir, file), 'utf8')))
  return files
}

function sync() {
  Object.entries(services).forEach(([name, actions]) => {
    const targetDir = path.join(root, 'cloudfunctions', name)
    fs.mkdirSync(targetDir, { recursive: true })
    expectedFiles(name, actions).forEach((content, file) => fs.writeFileSync(path.join(targetDir, file), content))
  })
  console.log('Cloud service packages synced:', Object.keys(services).join(', '))
}

if (require.main === module) sync()
module.exports = { services, expectedFiles, sync }
