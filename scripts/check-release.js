const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const packageJson = readJson('package.json')
const app = readJson('app.json')
const project = readJson('project.config.json')
const { FEATURES } = require('../utils/features')
const { services, expectedFiles } = require('./sync-cloud-services')

assert.equal(packageJson.version, '3.0.0-product-v0')
assert.equal(FEATURES.v3ProductV0, true)
assert.equal(FEATURES.v3ProductPreview, false)
assert.equal(FEATURES.v3CalibratedProduction, false)
;['pages/home/index', 'pages/questionnaire-v3/index', 'pages/v3-checkpoint/index', 'pages/v3-result/index', 'pages/v3-result-evidence/index', 'pages/privacy/index'].forEach(route => assert.ok(app.pages.includes(route), `${route} is not registered`))
;['pages/questionnaire-v3-pilot/index', 'pages/v3-p0-research/index', 'pages/v3-p0-coding/index', 'pages/v3-product-preview/index'].forEach(route => assert.equal(app.pages.includes(route), false, `${route} must stay out of the public app manifest`))

const ignoredFolders = new Set((project.packOptions && project.packOptions.ignore || []).filter(item => item.type === 'folder').map(item => item.value.replace(/\\/g, '/')))
assert.ok(ignoredFolders.has('cloudfunctions'), 'cloudfunctions must stay out of the mini program source package')
assert.equal(ignoredFolders.has('miniprogram_npm/tdesign-miniprogram/miniprogram_npm'), false, 'TDesign runtime dependency folder must stay in the mini program package')
;['pages/questionnaire-v3-pilot', 'pages/v3-p0-research', 'pages/v3-p0-coding', 'pages/v3-product-preview', 'shared/assessment-v3-pilot', 'utils/assessment-v3-pilot', 'shared/assessment-v3-p0', 'utils/assessment-v3-p0'].forEach(folder => assert.ok(ignoredFolders.has(folder), `${folder} must stay out of the release package`))

const productBundle = fs.readFileSync(path.join(root, 'shared/assessment-v3-product-v0/questionnaire-bundle.js'), 'utf8')
assert.equal(productBundle.includes('assessment-v3-pilot/runtime-bundle'), false, 'Product v0 bundle still pulls the research Pilot runtime')
const productRenderer = fs.readFileSync(path.join(root, 'shared/assessment-v3-product/report-renderer.js'), 'utf8')
assert.equal(productRenderer.includes('assessment-v3-pilot'), false, 'Production report renderer still pulls the research Pilot runtime')

const generatedProductFiles = [
  'assessment-v3-product-v0-questionnaire.generated.js',
  'assessment-v3-product-v0-scoring.generated.js',
  'assessment-v3-product-normative.generated.js',
  'assessment-v3-product-contract.generated.js',
  'assessment-v3-product-pattern-eligibility.generated.js',
  'assessment-v3-product-v0-runtime.generated.js',
  'assessment-v3-product-report-renderer.generated.js',
  'public-language.generated.js'
]
;['cloudfunctions/datingProfile', 'cloudfunctions/assessmentService', 'cloudfunctions/participantService', 'cloudfunctions/interviewOps'].forEach(directory => generatedProductFiles.forEach(file => assert.ok(fs.existsSync(path.join(root, directory, file)), `${directory}/${file} is missing`)))
Object.entries(services).forEach(([name, actions]) => expectedFiles(name, actions).forEach((expected, file) => assert.equal(fs.readFileSync(path.join(root, 'cloudfunctions', name, file), 'utf8'), expected, `${name}/${file} is stale`)))
generatedProductFiles.forEach(file => assert.equal(fs.readFileSync(path.join(root, 'cloudfunctions/datingProfile', file), 'utf8'), fs.readFileSync(path.join(root, 'cloudfunctions/assessmentService', file), 'utf8'), `datingProfile/${file} is stale`))

const cloudConfigPath = path.join(root, 'config/cloud.js')
if (fs.existsSync(cloudConfigPath)) {
  const cloudConfig = require(cloudConfigPath)
  assert.match(String(cloudConfig.envId || ''), /^cloud[0-9a-z-]+$/i)
  assert.ok(String(cloudConfig.operatorName || '').trim())
  assert.equal(cloudConfig.assessmentFunction || 'assessmentService', 'assessmentService')
  assert.equal(cloudConfig.participantFunction || 'participantService', 'participantService')
}

console.log('Release gate OK: Product v0 is public, preview/research runtimes are excluded, generated cloud packages are current, and local cloud configuration is valid when present')
