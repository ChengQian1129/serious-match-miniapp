const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')

const originalLoad = Module._load
const forwarded = []
Module._load = function load(request, parent, isMain) {
  if (request === './core' && /cloudfunctions[\\/](assessmentService|participantService|interviewOps)[\\/]index\.js$/.test(parent.filename)) {
    return { async main(event) { forwarded.push(event.action); return { ok: true, data: { action: event.action } } } }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const assessment = require(path.resolve(__dirname, '../cloudfunctions/assessmentService/index.js'))
const participant = require(path.resolve(__dirname, '../cloudfunctions/participantService/index.js'))
const interview = require(path.resolve(__dirname, '../cloudfunctions/interviewOps/index.js'))
Module._load = originalLoad

async function run() {
  assert.equal((await assessment.main({ action: 'assessmentGet' })).ok, true)
  assert.equal((await assessment.main({ action: 'participantGet' })).code, 'UNKNOWN_ACTION')
  assert.equal((await participant.main({ action: 'participantGet' })).ok, true)
  assert.equal((await participant.main({ action: 'assessmentGet' })).code, 'UNKNOWN_ACTION')
  assert.equal((await interview.main({ action: 'caseGet' })).ok, true)
  assert.equal((await interview.main({ action: 'assessmentGet' })).code, 'UNKNOWN_ACTION')
  assert.deepEqual(forwarded, ['assessmentGet', 'participantGet', 'caseGet'])

  const functionCalls = []
  global.wx = { cloud: { init() {}, callFunction(options) { functionCalls.push(options.name); options.success({ result: { ok: true, data: {} } }) } } }
  Module._load = function load(request, parent, isMain) {
    if (request === '../config/cloud' && /utils[\\/]cloud\.js$/.test(parent.filename)) return { envId: 'test-env', operatorName: 'test-operator', profileFunction: 'datingProfile', assessmentFunction: 'assessmentService', participantFunction: 'participantService' }
    return originalLoad.call(this, request, parent, isMain)
  }
  const cloudPath = path.resolve(__dirname, '../utils/cloud.js')
  delete require.cache[require.resolve(cloudPath)]
  const client = require(cloudPath)
  Module._load = originalLoad
  client.getAssessmentFromCloud('', {})
  client.getParticipant({})
  client.deleteCloudProfile({})
  assert.deepEqual(functionCalls, ['assessmentService', 'participantService', 'datingProfile'])
  console.log('Cloud service boundary OK: isolated allowlists and client routing')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
