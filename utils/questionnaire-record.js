const { RESPONSE_SCALES, getModule, getItem } = require('./questionnaire-definitions')
const { evaluateQuestionnaire } = require('./questionnaire-engine')

const QUESTIONNAIRE_DATA_SCHEMA_VERSION = 'questionnaire-data-1.0'

function emptyQuestionnaireData(createdAt = 0) {
  return {
    schemaVersion: QUESTIONNAIRE_DATA_SCHEMA_VERSION,
    modules: {},
    createdAt,
    updatedAt: createdAt
  }
}

function cloneModule(moduleRecord) {
  return Object.assign({}, moduleRecord, {
    answerEvents: (moduleRecord.answerEvents || []).map(event => Object.assign({}, event))
  })
}

function latestEventByItem(moduleRecord) {
  const latest = {}
  ;(moduleRecord && moduleRecord.answerEvents || []).forEach(event => {
    const previous = latest[event.itemId]
    if (!previous || event.answeredAt > previous.answeredAt || (
      event.answeredAt === previous.answeredAt && event.answerEventId > previous.answerEventId
    )) {
      latest[event.itemId] = event
    }
  })
  return latest
}

function latestAnswers(moduleRecord) {
  return Object.fromEntries(Object.entries(latestEventByItem(moduleRecord)).map(([itemId, event]) => [itemId, event.rawValue]))
}

function validateAnswer(moduleId, itemId, rawValue) {
  const module = getModule(moduleId)
  const item = getItem(itemId)
  if (!module || !item || item.moduleId !== moduleId) throw new Error(`题目 ${itemId} 不属于模块 ${moduleId}`)
  const scale = RESPONSE_SCALES[item.scaleId]
  if (!scale.values.includes(rawValue)) throw new Error(`回答 ${itemId} 不在量尺 ${item.scaleId} 的允许范围内`)
  return { module, item }
}

function appendAnswerEvent(data, moduleId, itemId, rawValue, options = {}) {
  const { module } = validateAnswer(moduleId, itemId, rawValue)
  const current = data && data.schemaVersion === QUESTIONNAIRE_DATA_SCHEMA_VERSION
    ? data
    : emptyQuestionnaireData(Number(options.answeredAt) || Date.now())
  const answeredAt = Number(options.answeredAt) || Date.now()
  const previousModule = current.modules[moduleId] || {
    moduleId,
    instrumentVersion: module.version,
    status: 'draft',
    answerEvents: [],
    evaluation: null,
    createdAt: answeredAt,
    updatedAt: answeredAt
  }
  if (previousModule.instrumentVersion !== module.version) throw new Error(`模块 ${moduleId} 的题目版本不一致`)

  const nextModule = cloneModule(previousModule)
  const previousEvent = latestEventByItem(previousModule)[itemId]
  const sequence = nextModule.answerEvents.length + 1
  const answerEvent = {
    answerEventId: options.answerEventId || `${moduleId}.${itemId}.${answeredAt}.${sequence}`,
    itemId,
    instrumentVersion: module.version,
    rawValue,
    answeredAt,
    supersedesAnswerEventId: previousEvent ? previousEvent.answerEventId : null
  }
  if (nextModule.answerEvents.some(event => event.answerEventId === answerEvent.answerEventId)) {
    throw new Error(`回答事件 ${answerEvent.answerEventId} 已存在`)
  }

  nextModule.answerEvents.push(answerEvent)
  nextModule.status = previousModule.status === 'complete' ? 'complete' : 'draft'
  nextModule.updatedAt = answeredAt
  nextModule.evaluation = evaluateQuestionnaire(moduleId, latestAnswers(nextModule), { evaluatedAt: answeredAt })

  return {
    data: {
      schemaVersion: QUESTIONNAIRE_DATA_SCHEMA_VERSION,
      modules: Object.assign({}, current.modules, { [moduleId]: nextModule }),
      createdAt: Number(current.createdAt) || answeredAt,
      updatedAt: answeredAt
    },
    answerEvent
  }
}

function completeModule(data, moduleId, completedAt = Date.now()) {
  const module = getModule(moduleId)
  if (!module) throw new Error(`未知问卷模块 ${moduleId}`)
  const current = data && data.schemaVersion === QUESTIONNAIRE_DATA_SCHEMA_VERSION ? data : emptyQuestionnaireData(completedAt)
  const previousModule = current.modules[moduleId]
  if (!previousModule || !previousModule.answerEvents.length) throw new Error(`模块 ${moduleId} 还没有回答`)
  const visitedCount = Object.keys(latestEventByItem(previousModule)).length
  if (visitedCount < module.items.length) throw new Error(`模块 ${moduleId} 还有未作答或未跳过的题目`)
  const nextModule = cloneModule(previousModule)
  nextModule.status = 'complete'
  nextModule.completedAt = completedAt
  nextModule.updatedAt = completedAt
  nextModule.evaluation = evaluateQuestionnaire(moduleId, latestAnswers(nextModule), { evaluatedAt: completedAt })
  return {
    schemaVersion: QUESTIONNAIRE_DATA_SCHEMA_VERSION,
    modules: Object.assign({}, current.modules, { [moduleId]: nextModule }),
    createdAt: current.createdAt,
    updatedAt: completedAt
  }
}

function moduleProgress(data, moduleId) {
  const module = getModule(moduleId)
  if (!module) return { answered: 0, total: 0, complete: false }
  const record = data && data.modules && data.modules[moduleId]
  return {
    answered: record ? Object.keys(latestEventByItem(record)).length : 0,
    total: module.items.length,
    complete: Boolean(record && record.status === 'complete')
  }
}

function hydrateQuestionnaireData(source) {
  if (!source || source.schemaVersion !== QUESTIONNAIRE_DATA_SCHEMA_VERSION || !source.modules || typeof source.modules !== 'object') {
    throw new Error('问卷数据结构无效')
  }
  const modules = {}
  Object.keys(source.modules).forEach(moduleId => {
    const definition = getModule(moduleId)
    const moduleRecord = source.modules[moduleId]
    if (!definition || !moduleRecord || moduleRecord.instrumentVersion !== definition.version) {
      throw new Error(`问卷模块 ${moduleId} 版本无效`)
    }
    const hydrated = cloneModule(moduleRecord)
    hydrated.evaluation = evaluateQuestionnaire(moduleId, latestAnswers(hydrated), {
      evaluatedAt: Number(hydrated.updatedAt) || Date.now()
    })
    modules[moduleId] = hydrated
  })
  return {
    schemaVersion: QUESTIONNAIRE_DATA_SCHEMA_VERSION,
    modules,
    createdAt: Number(source.createdAt) || Date.now(),
    updatedAt: Number(source.updatedAt) || 0
  }
}

module.exports = {
  QUESTIONNAIRE_DATA_SCHEMA_VERSION,
  emptyQuestionnaireData,
  appendAnswerEvent,
  completeModule,
  latestAnswers,
  latestEventByItem,
  moduleProgress,
  hydrateQuestionnaireData
}
