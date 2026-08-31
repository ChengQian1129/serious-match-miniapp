const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const productPages = [
  'pages/home/index.js',
  'pages/questionnaire-v3/index.js',
  'pages/v3-checkpoint/index.js',
  'pages/v3-answer-review/index.js',
  'pages/v3-result/index.js',
  'pages/v3-result-evidence/index.js'
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')

const requiredEvents = [
  'assessment_start',
  'section_start',
  'section_complete',
  'section_pause',
  'partial_result_view',
  'final_result_view',
  'answer_review_view',
  'answer_edit_start',
  'answer_edit_complete',
  'result_feedback_submit'
]

requiredEvents.forEach(eventName => {
  const marker = `'${eventName}'`
  const markerIndex = productPages.indexOf(marker)
  assert.ok(markerIndex >= 0, `${eventName} is not wired`)
  const eventCall = productPages.slice(Math.max(0, markerIndex - 30), markerIndex + 700)
  ;['rawValue', 'freeText', 'phone', 'wechat', '微信号', '姓名'].forEach(forbidden => {
    assert.equal(eventCall.includes(forbidden), false, `${eventName} contains ${forbidden}`)
  })
})

assert.match(productPages, /sectionEnterAt/)
assert.match(productPages, /sectionCompleteAt/)
assert.match(productPages, /sectionPauseAt/)
assert.match(productPages, /taskIndex/)
assert.match(productPages, /sectionId/)

console.log('Product v0 telemetry OK: required milestones are wired with privacy-safe progress fields')
