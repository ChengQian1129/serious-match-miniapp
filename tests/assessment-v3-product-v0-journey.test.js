const assert = require('node:assert/strict')
const runtime = require('../shared/assessment-v3-product-v0/runtime-engine')
const journey = require('../utils/assessment-v3-product-v0/journey-model')
const { buildPartialReport } = require('../shared/assessment-v3-product/report-renderer')

function valueFor(entry) {
  const format = runtime.resolveFormat(entry.item.response)
  if (format.type === 'single_select') return format.options[0].code
  if (format.type === 'multi_select') return format.options.slice(0, Number(format.validation && format.validation.minSelections) || 1).map(option => option.code)
  if (format.type === 'number') return String(format.validation && format.validation.min !== undefined ? format.validation.min : 1)
  return 'Product v0 journey test'
}

const sections = journey.getSections()
assert.equal(sections.length, 10)
assert.deepEqual(sections.map(section => section.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'ENTRY_FACTS', 'PART_B_L3_OPERATING_MODEL', 'PART_B_L4_PARTNER_DECISION', 'PART_B_L5_LIFE_DESIGN'])
assert.equal(sections.reduce((sum, section) => sum + section.taskCount, 0), runtime.BUNDLE.orderedParentTaskIds.length)
assert.equal(sections.every(section => section.taskCount > 0), true)
assert.equal(journey.sectionKeyForTask('L5-AGE01'), 'PART_B_L5_LIFE_DESIGN')

let session = runtime.createEmptySession(100)
let timestamp = 200
const firstSection = sections[0]
firstSection.taskIds.forEach(taskId => runtime.itemEntries(runtime.getTask(taskId)).forEach(entry => {
  session = runtime.answerItem(session, entry.itemId, valueFor(entry), timestamp)
  timestamp += 1
}))

assert.equal(journey.isSectionComplete(session, 'C1'), true)
assert.equal(journey.getGlobalProgress(session).completedSections, 1)
assert.equal(journey.getGlobalProgress(session).isComplete, false)
assert.equal(journey.getNextIncompleteSection(session).id, 'C2')
const partial = buildPartialReport(runtime.deriveProfile(session), ['C1'])
assert.deepEqual(partial.chapterSyntheses.map(chapter => chapter.id), ['C1'])
assert.equal(partial.decisionMap.sections.length, 0)

runtime.BUNDLE.orderedParentTaskIds.forEach(taskId => {
  if (firstSection.taskIds.includes(taskId)) return
  runtime.itemEntries(runtime.getTask(taskId)).forEach(entry => {
    session = runtime.answerItem(session, entry.itemId, valueFor(entry), timestamp)
    timestamp += 1
  })
})
assert.equal(journey.isAssessmentComplete(session), true)
assert.equal(journey.getGlobalProgress(session).completedSections, 10)
assert.equal(journey.getGlobalProgress(session).ratio, 1)

console.log('Product v0 journey OK: runtime-driven 10-section progress, partial disclosure, and full completion')
