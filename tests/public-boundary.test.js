const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

const root = path.resolve(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
assert.equal(app.pages.includes('pages/compare/index'), false)
assert.equal(app.pages.includes('pages/profile-preview/index'), false)
assert.equal(app.pages.includes('pages/contact/index'), false)
assert.equal(app.pages.includes('pages/profile/index'), false)
assert.equal(app.pages.includes('pages/followup-intro/index'), true)
const cloudClient = fs.readFileSync(path.join(root, 'utils/cloud.js'), 'utf8')
;['createCompareInvite', 'joinCompareInvite', 'getCompareInvite'].forEach(name => assert.equal(cloudClient.includes(name), false))

const banned = /匹配池|候选人|适合对象|关系对照|邀请朋友|匿名介绍|希望认识|出现合适人选|认真匹配|匿名档案/
app.pages.map(page => path.join(root, page + '.wxml')).forEach(file => {
  const source = fs.readFileSync(file, 'utf8')
  assert.equal(banned.test(source), false, 'banned public copy in ' + path.relative(root, file))
})

const cloudPath = path.join(root, 'cloudfunctions/datingProfile/index.js')
const originalLoad = Module._load
Module._load = function load(request, parent, isMain) {
  if (request === 'wx-server-sdk') return {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    getWXContext() { return { OPENID: 'boundary-user' } },
    database() {
      return {
        command: {},
        collection() { return {} }
      }
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}
delete require.cache[require.resolve(cloudPath)]
const cloudFunction = require(cloudPath)
Module._load = originalLoad

Promise.all([
  'compareInviteCreate',
  'compareInviteJoin',
  'compareGet',
  'save',
  'get',
  'setStatus',
  'saveExploration',
  'saveRecordFeedback',
  'saveQuestionnaireModule',
  'assessmentConfirmClaim'
].map(action => cloudFunction.main({ action }))).then(results => {
  results.forEach(result => assert.equal(result.code, 'UNKNOWN_ACTION'))
  console.log('Public boundary OK: obsolete routes, copy, and cloud actions are closed')
}).catch(error => { console.error(error); process.exitCode = 1 })
