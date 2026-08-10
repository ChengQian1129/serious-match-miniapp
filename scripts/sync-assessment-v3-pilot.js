const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const YAML = require('yaml')
const PUBLIC_LANGUAGE = require('../shared/content/public-language.generated')

const ROOT = path.resolve(__dirname, '..')
const SOURCE_ROOT = path.join(ROOT, 'research', 'v3')
const BUNDLE_PATH = path.join(ROOT, 'shared', 'assessment-v3-pilot', 'runtime-bundle.js')
const MANIFEST_PATH = path.join(ROOT, 'shared', 'assessment-v3-pilot', 'manifest.json')

function readYaml(relativePath) {
  return YAML.parse(fs.readFileSync(path.join(SOURCE_ROOT, relativePath), 'utf8'))
}

function fail(message) { throw new Error(`V3 source validation failed: ${message}`) }

function assert(condition, message) { if (!condition) fail(message) }

function walkFiles(directory, relative = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name)
    const next = path.posix.join(relative, entry.name)
    return entry.isDirectory() ? walkFiles(absolute, next) : [next]
  })
}

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }

function allFormatRefs(value, result = []) {
  if (!value || typeof value !== 'object') return result
  if (value.formatRef) result.push(String(value.formatRef))
  Object.values(value).forEach(child => allFormatRefs(child, result))
  return result
}

function taskHasValidationOnly(task) {
  return Array.isArray(task.tags) && task.tags.includes('VALIDATION_ONLY')
}

function taskIdsFromFormFile(form) {
  return Object.values(form.samplingPools || {}).flatMap(pool => (pool.tasks || []).map(task => task.taskId))
}

function normalizePool(pool) {
  return {
    pool: (pool.tasks || []).map(task => task.taskId),
    sample: Number(pool.sampleCount)
  }
}

function validateResponseCode(task, formatName, format) {
  if (!format || !format.type) return
  if (!['single_select', 'multi_select'].includes(format.type)) return
  const codes = new Set((format.options || []).map(option => String(option.code)))
  assert(codes.size > 0, `${task.taskId}: ${formatName} has no options`)
}

function validateSources() {
  const freeze = readYaml('normative/questionnaire_candidate_freeze.yaml')
  const core = readYaml('normative/report_core_candidate.yaml')
  const registry = readYaml('normative/construct_registry.yaml')
  const responseLibrary = readYaml('normative/response_formats.yaml')
  const manifest = readYaml('pilot/P1_form_manifest.yaml')
  const commonFile = readYaml('pilot/P1_common_spine.yaml')
  const formFiles = {
    A: readYaml('pilot/P1_form_A.yaml'),
    B: readYaml('pilot/P1_form_B.yaml'),
    C: readYaml('pilot/P1_form_C.yaml')
  }
  const branchRules = readYaml('pilot/active_branch_rules.yaml')

  const tasks = freeze.tasks || {}
  const taskIds = Object.keys(tasks)
  const constructIds = new Set(Object.keys(registry.constructs || {}))
  const formats = responseLibrary.formats || freeze.responseFormats || {}
  assert(taskIds.length === 411, `expected 411 candidate parents, got ${taskIds.length}`)
  assert(Number(freeze.counts && freeze.counts.parentTasks) === 411, 'candidate count metadata is not 411')
  assert(constructIds.size === 60, `expected 60 constructs, got ${constructIds.size}`)
  assert(Object.keys(formats).length === 14, `expected 14 response formats, got ${Object.keys(formats).length}`)

  const childIds = new Set()
  taskIds.forEach(taskId => {
    const task = tasks[taskId]
    assert(task && task.taskId === taskId, `${taskId}: taskId mismatch`)
    assert(constructIds.has(task.constructId), `${taskId}: unknown construct ${task.constructId}`)
    allFormatRefs(task).forEach(formatRef => assert(formats[formatRef], `${taskId}: unknown formatRef ${formatRef}`))
    ;(task.children || []).forEach(child => {
      assert(child.itemId, `${taskId}: child is missing itemId`)
      assert(!childIds.has(child.itemId), `duplicate child id ${child.itemId}`)
      assert(!tasks[child.itemId], `child id collides with parent ${child.itemId}`)
      childIds.add(child.itemId)
    })
    if (task.response && task.response.inlineFormat) validateResponseCode(task, 'inlineFormat', task.response.inlineFormat)
  })

  assert(Number(core.parentTaskCount) === 266, 'REPORT_CORE parentTaskCount is not 266')
  assert(Object.keys(core.tasks || {}).length === 266, 'REPORT_CORE task map is not 266')
  assert((core.orderedParentTaskIds || []).length === 266, 'REPORT_CORE order is not 266')
  assert(new Set(core.orderedParentTaskIds).size === 266, 'REPORT_CORE contains duplicate parents')
  core.orderedParentTaskIds.forEach(taskId => {
    assert(tasks[taskId], `REPORT_CORE references unknown task ${taskId}`)
    assert(!taskHasValidationOnly(tasks[taskId]), `REPORT_CORE contains validation-only task ${taskId}`)
  })

  const commonTaskIds = Object.values(manifest.commonSpine.sections || {}).flat()
  assert(commonTaskIds.length === 57, `expected 57 common tasks, got ${commonTaskIds.length}`)
  assert(new Set(commonTaskIds).size === commonTaskIds.length, 'Common Spine contains duplicate parents')
  commonTaskIds.forEach(taskId => assert(tasks[taskId], `Common Spine references unknown task ${taskId}`))

  const formNameByKey = { A: 'A_reactive_psychometric', B: 'B_needs_capabilities', C: 'C_operating_decision' }
  const forms = {}
  const commonSet = new Set(commonTaskIds)
  Object.entries(formNameByKey).forEach(([formKey, formName]) => {
    const manifestForm = manifest.forms && manifest.forms[formName]
    const sourceForm = formFiles[formKey]
    assert(manifestForm && sourceForm, `missing form ${formKey}`)
    const sourcePoolMap = Object.fromEntries(Object.values(sourceForm.samplingPools || {}).map(pool => [pool.poolId, normalizePool(pool)]))
    const pools = {}
    Object.entries(manifestForm.samplingPools || {}).forEach(([poolId, definition]) => {
      const pool = { pool: (definition.pool || []).map(String), sample: Number(definition.sample) }
      assert(sourcePoolMap[poolId], `${formKey}/${poolId}: missing source pool`)
      assert(JSON.stringify(pool.pool) === JSON.stringify(sourcePoolMap[poolId].pool), `${formKey}/${poolId}: manifest/source pool drift`)
      assert(pool.sample === sourcePoolMap[poolId].sample, `${formKey}/${poolId}: sample count drift`)
      assert(pool.sample <= pool.pool.length, `${formKey}/${poolId}: sample exceeds pool`)
      const seen = new Set()
      pool.pool.forEach(taskId => {
        assert(tasks[taskId], `${formKey}/${poolId}: unknown task ${taskId}`)
        assert(!commonSet.has(taskId), `${formKey}/${poolId}: overlaps Common Spine at ${taskId}`)
        assert(!seen.has(taskId), `${formKey}/${poolId}: duplicate task ${taskId}`)
        seen.add(taskId)
      })
      pools[poolId] = pool
    })
    forms[formKey] = { id: formName, pools }
  })

  const activeRules = branchRules.rules || []
  activeRules.forEach(rule => {
    const conditions = rule.when ? [rule.when] : (rule.whenAny || [])
    assert(rule.id && conditions.length, `branch ${rule.id || '<unknown>'} has no machine-readable condition`)
    conditions.forEach(condition => {
      assert(tasks[condition.taskId], `branch ${rule.id}: unknown trigger ${condition.taskId}`)
      const trigger = tasks[condition.taskId]
      const response = trigger.response && (trigger.response.inlineFormat || formats[trigger.response.formatRef])
      const validCodes = new Set((response && response.options || []).map(option => String(option.code)))
      condition.codes.forEach(code => assert(validCodes.has(String(code)), `branch ${rule.id}: invalid code ${code} for ${condition.taskId}`))
    })
    ;(rule.enable || []).forEach(taskId => assert(tasks[taskId], `branch ${rule.id}: unknown enabled task ${taskId}`))
  })

  const sourceFiles = {}
  walkFiles(SOURCE_ROOT).sort().forEach(relative => {
    const content = fs.readFileSync(path.join(SOURCE_ROOT, relative))
    sourceFiles[relative] = sha256(content)
  })

  const bundle = {
    instrument: {
      id: 'relationship_manual_v3_pilot',
      version: '3.0.0-p0.5',
      scoring: 'NONE_IN_RUNTIME',
      manifestVersion: '0.3',
      taskLibraryVersion: '0.1',
      responseFormatVersion: '0.1'
    },
    responseFormats: freeze.responseFormats || formats,
    tasks,
    commonSpine: commonTaskIds,
    forms,
    branches: { early: activeRules, post: [], deferred: branchRules.deferred || [] },
    missingnessCodes: ['NOT_SHOWN_BY_DESIGN', 'NOT_APPLICABLE', 'USER_SKIPPED', 'TECHNICAL_MISSING', 'UNKNOWN'],
    reportCore: { parentTaskCount: 266, orderedParentTaskIds: core.orderedParentTaskIds },
    constructIds: [...constructIds].sort()
  }
  const pilotPublicCopy = Object.assign({}, PUBLIC_LANGUAGE.v3)
  delete pilotPublicCopy.product
  bundle.publicCopy = Object.assign({}, pilotPublicCopy, {
    chapterTitles: PUBLIC_LANGUAGE.v2.chapterTitles,
    pageTitle: PUBLIC_LANGUAGE.ui.v3Pilot.pageTitle
  })
  const manifestOutput = {
    schemaVersion: 'relationship-feature-model-v3.runtime-manifest.v0.1',
    generatedAt: '2026-08-09',
    instrument: bundle.instrument,
    sourceFiles,
    counts: {
      candidateParentTasks: taskIds.length,
      reportCoreParentTasks: core.orderedParentTaskIds.length,
      commonParentTasks: commonTaskIds.length,
      runtimeTaskLibrary: taskIds.length,
      childResponseFields: childIds.size,
      constructRegistryObjects: constructIds.size
    },
    runtimeHash: sha256(JSON.stringify(bundle))
  }
  return { bundle, manifest: manifestOutput }
}

function renderBundle(bundle) {
  return `// Generated by scripts/sync-assessment-v3-pilot.js. Do not hand-edit.\nmodule.exports = ${JSON.stringify(bundle, null, 2)}\n`
}

function renderManifest(manifest) { return `${JSON.stringify(manifest, null, 2)}\n` }

function main() {
  const artifacts = validateSources()
  fs.mkdirSync(path.dirname(BUNDLE_PATH), { recursive: true })
  fs.writeFileSync(BUNDLE_PATH, renderBundle(artifacts.bundle))
  fs.writeFileSync(MANIFEST_PATH, renderManifest(artifacts.manifest))
  console.log(`Assessment V3 pilot synced: ${artifacts.manifest.runtimeHash}`)
}

if (require.main === module) main()

module.exports = { validateSources, renderBundle, renderManifest, BUNDLE_PATH, MANIFEST_PATH }
