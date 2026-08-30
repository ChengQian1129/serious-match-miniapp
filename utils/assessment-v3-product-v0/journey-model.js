const runtime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const publicLanguage = require('../../shared/content/public-language.generated')

const PRODUCT_COPY = publicLanguage.v3 && publicLanguage.v3.productV0 || {}

// The task universe stays in the canonical questionnaire bundle. This layer only
// translates the bundle's chapter/part metadata into user-facing journey sections.
const SECTION_DEFINITIONS = Object.freeze([
  { id: 'C1', sourceKey: 'C1' },
  { id: 'C2', sourceKey: 'C2' },
  { id: 'C3', sourceKey: 'C3' },
  { id: 'C4', sourceKey: 'C4' },
  { id: 'C5', sourceKey: 'C5' },
  { id: 'C6', sourceKey: 'C6' },
  { id: 'ENTRY_FACTS', sourceKey: 'ENTRY_FACTS' },
  { id: 'PART_B_L3_OPERATING_MODEL', sourceKey: 'PART_B_L3_OPERATING_MODEL' },
  { id: 'PART_B_L4_PARTNER_DECISION', sourceKey: 'PART_B_L4_PARTNER_DECISION' },
  { id: 'PART_B_L5_LIFE_DESIGN', sourceKey: 'PART_B_L5_LIFE_DESIGN' }
])

const PART_ALIASES = Object.freeze({
  PART_B_L5_LIFE_PLAN: 'PART_B_L5_LIFE_DESIGN'
})

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function sectionKeyForTask(taskId) {
  const task = runtime.getTask(taskId)
  const meta = task && task.freezeMeta || {}
  if (meta.chapter) return meta.chapter
  return PART_ALIASES[meta.part] || meta.part || ''
}

function sectionCopy(sectionId, copy = PRODUCT_COPY) {
  const source = copy.journey && copy.journey.sections && copy.journey.sections[sectionId]
  return source && typeof source === 'object' ? source : {}
}

function getSections(copy = PRODUCT_COPY) {
  const taskIds = runtime.BUNDLE.orderedParentTaskIds || []
  return SECTION_DEFINITIONS.map(definition => {
    const source = sectionCopy(definition.id, copy)
    const ids = taskIds.filter(taskId => sectionKeyForTask(taskId) === definition.id)
    return {
      id: definition.id,
      sourceKey: definition.sourceKey,
      title: source.title || source.label || '',
      description: source.description || '',
      completedTitle: source.completedTitle || '',
      remainingSectionsTemplate: source.remainingSectionsTemplate || '',
      checkpointType: source.checkpointType || (definition.id.startsWith('C') ? 'insight' : 'transition'),
      requiredForFinalReport: source.requiredForFinalReport !== false,
      taskIds: ids,
      taskCount: ids.length
    }
  })
}

function resolveSection(sectionIdOrTaskId, copy = PRODUCT_COPY) {
  const sections = getSections(copy)
  return sections.find(section => section.id === sectionIdOrTaskId || section.taskIds.includes(sectionIdOrTaskId)) || null
}

function getSectionForTask(taskId, copy = PRODUCT_COPY) {
  return resolveSection(taskId, copy)
}

function getSectionIndexForTask(taskId, copy = PRODUCT_COPY) {
  const section = getSectionForTask(taskId, copy)
  return section ? getSections(copy).findIndex(candidate => candidate.id === section.id) : -1
}

function getTaskIndexById(taskId) {
  return (runtime.BUNDLE.orderedParentTaskIds || []).indexOf(taskId)
}

function answerMaps(session) {
  return {
    answers: session && (session.latestAnswers || session.answers) || {},
    missingness: session && session.missingness || {}
  }
}

function isTaskComplete(session, taskId) {
  const task = runtime.getTask(taskId)
  if (!task) return false
  const maps = answerMaps(session)
  return runtime.itemEntries(task).every(entry => runtime.isAccounted(entry.itemId, maps.answers, maps.missingness))
}

function getSectionProgress(session, sectionIdOrTaskId, copy = PRODUCT_COPY) {
  const section = resolveSection(sectionIdOrTaskId, copy)
  if (!section) return { sectionId: '', completedTasks: 0, totalTasks: 0, ratio: 0, isComplete: false, sectionNumber: 0, sectionCount: getSections(copy).length }
  const completedTasks = section.taskIds.filter(taskId => isTaskComplete(session, taskId)).length
  const totalTasks = section.taskIds.length
  const sectionNumber = getSections(copy).findIndex(candidate => candidate.id === section.id) + 1
  return {
    sectionId: section.id,
    completedTasks,
    totalTasks,
    ratio: totalTasks ? completedTasks / totalTasks : 0,
    isComplete: totalTasks > 0 && completedTasks === totalTasks,
    sectionNumber,
    sectionCount: getSections(copy).length
  }
}

function getGlobalProgress(session, copy = PRODUCT_COPY) {
  const sections = getSections(copy)
  const totalTasks = sections.reduce((total, section) => total + section.taskIds.length, 0)
  const completedTasks = sections.reduce((total, section) => total + section.taskIds.filter(taskId => isTaskComplete(session, taskId)).length, 0)
  const completedSections = sections.filter(section => getSectionProgress(session, section.id, copy).isComplete).length
  const requiredSections = sections.filter(section => section.requiredForFinalReport)
  const requiredCompletedSections = requiredSections.filter(section => getSectionProgress(session, section.id, copy).isComplete).length
  return {
    completedTasks,
    totalTasks,
    ratio: totalTasks ? completedTasks / totalTasks : 0,
    completedSections,
    requiredCompletedSections,
    totalSections: sections.length,
    requiredSections: requiredSections.length,
    sectionRatio: sections.length ? completedSections / sections.length : 0,
    isComplete: requiredSections.length > 0 && requiredCompletedSections === requiredSections.length
  }
}

function getCompletedSections(session, copy = PRODUCT_COPY) {
  return getSections(copy).filter(section => getSectionProgress(session, section.id, copy).isComplete)
}

function getNextIncompleteSection(session, copy = PRODUCT_COPY) {
  return getSections(copy).find(section => !getSectionProgress(session, section.id, copy).isComplete) || null
}

function isSectionComplete(session, sectionId, copy = PRODUCT_COPY) {
  return getSectionProgress(session, sectionId, copy).isComplete
}

function isAssessmentComplete(session, copy = PRODUCT_COPY) {
  return getGlobalProgress(session, copy).isComplete
}

function currentSection(session, copy = PRODUCT_COPY) {
  const index = Number(session && session.currentTaskIndex)
  const taskId = Number.isInteger(index) ? runtime.BUNDLE.orderedParentTaskIds[index] : ''
  return getSectionForTask(taskId, copy) || getNextIncompleteSection(session, copy) || getSections(copy)[0] || null
}

module.exports = {
  SECTION_DEFINITIONS,
  PART_ALIASES,
  sectionKeyForTask,
  getSections,
  getSectionForTask,
  getSectionIndexForTask,
  getTaskIndexById,
  getSectionProgress,
  getGlobalProgress,
  getCompletedSections,
  getNextIncompleteSection,
  isSectionComplete,
  isAssessmentComplete,
  isTaskComplete,
  currentSection,
  clone
}
