const assert = require('node:assert/strict')

global.wx = {
  getStorageSync() { return undefined },
  setStorageSync() {},
  removeStorageSync() {}
}
global.Page = () => {}

const page = require('../pages/questionnaire-v3-pilot/index.js')
const engine = require('../shared/assessment-v3-pilot/runtime-engine')

const baseSession = { answers: {}, missingness: {} }

const single = page.buildTaskView(engine.getTask('RR01'), {
  answers: { RR01: '7' },
  missingness: {}
})
assert.equal(single.items.length, 1)
assert.equal(single.items[0].response.options.find(option => option.code === '7').selected, true)

const compound = page.buildTaskView(engine.getTask('SN-S01'), {
  answers: { 'SN-S01.a': ['1', '2'] },
  missingness: { 'SN-S01.b': { code: 'USER_SKIPPED' } }
})
assert.equal(compound.isCompound, true)
assert.equal(compound.items.length, 2)
assert.equal(compound.items[0].response.options.find(option => option.code === '1').selected, true)
assert.equal(compound.items[0].response.options.find(option => option.code === '2').selected, true)
assert.equal(compound.items[1].response.missing, true)

const freqTask = Object.values(engine.BUNDLE.tasks).find(task => task.response && task.response.formatRef === 'FREQ5_NA')
assert.ok(freqTask)
const missingOption = page.responseView(freqTask.taskId, freqTask.response, baseSession.answers, {
  [freqTask.taskId]: { code: 'NOT_APPLICABLE' }
}).options.find(option => option.isMissing)
assert.equal(missingOption.selected, true)
assert.equal(page.formatHint({ type: 'multi_select', validation: { minSelections: 1, maxSelections: 2 } }), '请选择 1–2 项')

const number = page.responseView('FACT01', engine.getTask('FACT01').response, { FACT01: 1988 }, {})
assert.equal(number.type, 'number')
assert.equal(number.value, 1988)
const textTask = Object.values(engine.BUNDLE.tasks).find(task => task.response && task.response.inlineFormat && task.response.inlineFormat.type === 'free_text')
assert.ok(textTask)
assert.equal(page.responseView(textTask.taskId, textTask.response, {}, {}).maxLength, textTask.response.inlineFormat.maxChars)

console.log('assessment-v3-pilot page mapping OK')
