const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const YAML = require('yaml')

const ROOT = path.resolve(__dirname, '..')
const SOURCE_ROOT = path.join(ROOT, 'research', 'v3')
const BUNDLE_PATH = path.join(ROOT, 'shared', 'assessment-v3-p0', 'generated', 'runtime-bundle.js')
const MANIFEST_PATH = path.join(ROOT, 'shared', 'assessment-v3-p0', 'generated', 'manifest.json')

function readText(relativePath) {
  return fs.readFileSync(path.join(SOURCE_ROOT, relativePath), 'utf8')
}

function readYaml(relativePath) {
  return YAML.parse(readText(relativePath))
}

function fail(message) {
  throw new Error(`V3 P0 source validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function walkFormatRefs(value, result = []) {
  if (!value || typeof value !== 'object') return result
  if (value.formatRef) result.push(String(value.formatRef))
  Object.values(value).forEach(child => walkFormatRefs(child, result))
  return result
}

function allResponseItems(task) {
  return task.children && task.children.length
    ? task.children
    : task.response ? [task] : []
}

function validateCodingGuide(guide) {
  const requiredTokens = [
    'comprehension:',
    'retrievalBasis:',
    'responseMapping:',
    'socialDesirability:',
    'emotionalSensitivity:',
    'constructContamination:',
    'recommendedAction:',
    'KEEP',
    'REWRITE',
    'SPLIT',
    'REROUTE',
    'DROP'
  ]
  requiredTokens.forEach(token => assert(guide.includes(token), `interview guide is missing ${token}`))
}

function validateSources() {
  const p0Spec = readYaml('pilot/P0_questionnaire_spec.yaml')
  const guide = readText('pilot/P0_cognitive_interview_guide.md')
  const analysisPlan = readText('pilot/pilot_analysis_plan.md')
  const freeze = readYaml('normative/questionnaire_candidate_freeze.yaml')
  const responseLibrary = readYaml('normative/response_formats.yaml')
  const dataDictionary = readYaml('normative/data_dictionary.yaml')
  const constructRegistry = readYaml('normative/construct_registry.yaml')

  validateCodingGuide(guide)
  assert(p0Spec.status === 'READY_FOR_COGNITIVE_INTERVIEW_BUILD_NOT_PRODUCTION', 'P0 spec is not marked ready for cognitive-interview build')
  assert(p0Spec.administration && p0Spec.administration.design === '3 iterative waves', 'P0 administration must define three iterative waves')

  const waveIds = Object.keys(p0Spec.waves || {})
  assert(JSON.stringify(waveIds) === JSON.stringify(['wave1', 'wave2', 'wave3']), `expected wave1/wave2/wave3, got ${waveIds.join(',')}`)
  const candidateTasks = freeze.tasks || {}
  const formats = responseLibrary.formats || {}
  const constructs = constructRegistry.constructs || {}
  const missingnessCodes = Object.keys(dataDictionary.missingnessCodes || {})
  const expectedMissingness = ['NOT_SHOWN_BY_DESIGN', 'NOT_APPLICABLE', 'USER_SKIPPED', 'TECHNICAL_MISSING', 'UNKNOWN']
  expectedMissingness.forEach(code => assert(missingnessCodes.includes(code), `data dictionary is missing ${code}`))

  const tasks = {}
  const taskIdsByWave = {}
  const allTaskIds = new Set()
  const allItemIds = new Set()
  const childIds = new Set()

  waveIds.forEach(waveId => {
    const waveTasks = p0Spec.waves[waveId]
    assert(Array.isArray(waveTasks) && waveTasks.length > 0, `${waveId} has no tasks`)
    taskIdsByWave[waveId] = []
    waveTasks.forEach(sourceTask => {
      const taskId = String(sourceTask.taskId)
      assert(!allTaskIds.has(taskId), `duplicate P0 parent task ${taskId}`)
      assert(!allItemIds.has(taskId), `parent task collides with child ${taskId}`)
      allTaskIds.add(taskId)

      const candidateTask = candidateTasks[taskId]
      assert(candidateTask, `${taskId} is not present in questionnaire candidate freeze`)
      assert(candidateTask.taskId === taskId, `${taskId}: candidate taskId mismatch`)
      assert(candidateTask.constructId === sourceTask.constructId, `${taskId}: construct mismatch with candidate freeze`)
      assert(constructs[sourceTask.constructId], `${taskId}: unknown construct ${sourceTask.constructId}`)
      assert(sourceTask.wave === waveId, `${taskId}: source wave mismatch`)
      assert(sourceTask.scoringStatus === 'PILOT_ONLY', `${taskId}: only PILOT_ONLY tasks may enter P0 runtime`)
      assert(!(candidateTask.tags || []).includes('VALIDATION_ONLY'), `${taskId}: validation-only task cannot enter participant flow`)
      assert(!candidateTask.reportContribution, `${taskId}: report-contributing task cannot enter P0 runtime`)

      const refs = walkFormatRefs(sourceTask.response)
      refs.forEach(ref => assert(formats[ref], `${taskId}: unknown response format ${ref}`))
      const children = (sourceTask.children || []).map(child => {
        const childId = String(child.itemId)
        assert(!childIds.has(childId), `duplicate P0 child item ${childId}`)
        assert(!candidateTasks[childId], `${childId}: child collides with candidate parent`)
        childIds.add(childId)
        allItemIds.add(childId)
        const candidateChild = (candidateTask.children || []).find(item => item.itemId === childId)
        assert(candidateChild, `${taskId}: child ${childId} is not resolvable in candidate freeze`)
        assert(candidateChild.constructId === undefined || candidateChild.constructId === sourceTask.constructId, `${childId}: child construct mismatch`)
        walkFormatRefs(child.response).forEach(ref => assert(formats[ref], `${childId}: unknown response format ${ref}`))
        return clone(child)
      })

      const runtimeTask = {
        taskId,
        wave: waveId,
        constructId: sourceTask.constructId,
        taskType: sourceTask.taskType,
        prompt: String(sourceTask.prompt || ''),
        responseContext: sourceTask.responseContext || null,
        probeFocus: clone(sourceTask.probeFocus || []),
        scoringStatus: 'PILOT_ONLY',
        itemVersion: `${p0Spec.schemaVersion}:${taskId}`,
        response: clone(sourceTask.response || null),
        children,
        sourceCandidateVersion: candidateTask.itemVersion || null
      }
      assert(runtimeTask.prompt || children.length, `${taskId}: task has no participant wording`)
      tasks[taskId] = runtimeTask
      taskIdsByWave[waveId].push(taskId)
    })
  })

  const codingSchema = {
    comprehension: ['correct', 'partially_correct', 'divergent', 'unclear'],
    retrievalBasis: ['recent_real_event', 'old_memory', 'general_self_image', 'hypothetical', 'social_rule'],
    responseMapping: ['easy', 'forced_between_options', 'missing_option'],
    socialDesirability: ['none', 'some', 'obvious'],
    emotionalSensitivity: ['low', 'medium', 'high'],
    recommendedAction: ['keep', 'rewrite', 'split', 'reroute', 'drop']
  }

  const debriefSchema = {
    hardestItemIds: 'item_ids',
    repetitiveItemIds: 'item_ids',
    correctAnswerFeelingItemId: 'item_id_or_null',
    importantUnaskedNote: 'free_text',
    askedTooEarlyItemId: 'item_id_or_null',
    privacySensitiveItemId: 'item_id_or_null',
    privateInterviewNote: 'free_text'
  }

  const sourcePaths = [
    'pilot/P0_questionnaire_spec.yaml',
    'pilot/P0_cognitive_interview_guide.md',
    'pilot/pilot_analysis_plan.md',
    'normative/questionnaire_candidate_freeze.yaml',
    'normative/response_formats.yaml',
    'normative/data_dictionary.yaml',
    'normative/construct_registry.yaml'
  ]
  const sourceHashes = Object.fromEntries(sourcePaths.map(relativePath => [relativePath, sha256(readText(relativePath))]))
  const instrument = {
    id: 'relationship_manual_v3_p0',
    version: '3.0.0-p0',
    scoring: 'NONE_IN_RUNTIME',
    p0SpecVersion: p0Spec.schemaVersion,
    questionnaireFreezeVersion: freeze.schemaVersion,
    responseFormatVersion: responseLibrary.schemaVersion
  }

  const bundle = {
    instrument,
    p0SpecVersion: p0Spec.schemaVersion,
    questionnaireFreezeVersion: freeze.schemaVersion,
    responseFormatVersion: responseLibrary.schemaVersion,
    contextCapture: clone(p0Spec.contextCapture || {}),
    waveIds,
    taskIdsByWave,
    tasks,
    responseFormats: clone(formats),
    missingnessCodes,
    codingSchema,
    debriefSchema,
    sourceHashes,
    scoring: 'NONE_IN_RUNTIME'
  }
  const manifest = {
    schemaVersion: 'relationship-feature-model-v3.p0-runtime-manifest.v0.1',
    generatedAt: p0Spec.generatedAt || 'unknown',
    instrumentId: instrument.id,
    instrumentVersion: instrument.version,
    scoring: instrument.scoring,
    p0SpecVersion: instrument.p0SpecVersion,
    questionnaireFreezeVersion: instrument.questionnaireFreezeVersion,
    responseFormatVersion: instrument.responseFormatVersion,
    waveIds,
    taskIdsByWave,
    counts: {
      parentTasks: allTaskIds.size,
      responseItems: allTaskIds.size + childIds.size,
      childItems: childIds.size,
      constructs: new Set(Object.values(tasks).map(task => task.constructId)).size
    },
    sourceHashes,
    runtimeHash: sha256(JSON.stringify(bundle))
  }
  bundle.manifestHash = sha256(JSON.stringify(manifest))
  return { bundle, manifest }
}

function renderBundle(bundle) {
  return `// Generated by scripts/sync-assessment-v3-p0.js. Do not hand-edit.\nmodule.exports = ${JSON.stringify(bundle, null, 2)}\n`
}

function renderManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function main() {
  const artifacts = validateSources()
  fs.mkdirSync(path.dirname(BUNDLE_PATH), { recursive: true })
  fs.writeFileSync(BUNDLE_PATH, renderBundle(artifacts.bundle), 'utf8')
  fs.writeFileSync(MANIFEST_PATH, renderManifest(artifacts.manifest), 'utf8')
  console.log(`Assessment V3 P0 synced: ${artifacts.manifest.runtimeHash}`)
}

if (require.main === module) main()

module.exports = { validateSources, renderBundle, renderManifest, BUNDLE_PATH, MANIFEST_PATH }
