const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
const runtime = require('../shared/assessment-v3-product-v0/runtime-engine')

const collections = new Map()
const clone = value => JSON.parse(JSON.stringify(value))
const rows = name => { if (!collections.has(name)) collections.set(name, new Map()); return collections.get(name) }
const removeToken = { __remove: true }

function applyUpdate(target, data) {
  const next = Object.assign({}, target || {})
  Object.entries(data).forEach(([key, value]) => { if (value && value.__remove) delete next[key]; else next[key] = clone(value) })
  return next
}

let currentOpenid = 'product-v0-user'
const cloudStub = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init() {},
  getWXContext() { return { OPENID: currentOpenid } },
  database() {
    return {
      command: { remove() { return removeToken } },
      serverDate() { return { $date: 'server' } },
      collection(name) {
        return {
          doc(id) {
            return {
              async get() { if (!rows(name).has(id)) throw new Error('document does not exist'); return { data: clone(rows(name).get(id)) } },
              async set({ data }) { assert.equal(Object.prototype.hasOwnProperty.call(data, '_id'), false); rows(name).set(id, Object.assign(clone(data), { _id: id })) },
              async update({ data }) { assert.equal(Object.prototype.hasOwnProperty.call(data, '_id'), false); rows(name).set(id, applyUpdate(rows(name).get(id), data)) },
              async remove() { rows(name).delete(id) }
            }
          },
          where(query) {
            const found = [...rows(name).values()].filter(row => Object.entries(query).every(([key, value]) => row[key] === value))
            return { limit() { return { async get() { return { data: clone(found) } } } } }
          }
        }
      }
    }
  }
}

const originalLoad = Module._load
Module._load = function load(request, parent, isMain) { if (request === 'wx-server-sdk') return cloudStub; return originalLoad.call(this, request, parent, isMain) }
const functionPath = path.resolve(__dirname, '../cloudfunctions/datingProfile/index.js')
delete require.cache[require.resolve(functionPath)]
const cloudFunction = require(functionPath)
Module._load = originalLoad

function valueFor(entry) {
  const format = runtime.resolveFormat(entry.item.response)
  if (format.type === 'single_select') return format.options[0].code
  if (format.type === 'multi_select') {
    const count = Number(format.validation && format.validation.minSelections) || 1
    return format.options.slice(0, count).map(option => option.code)
  }
  if (format.type === 'number') return String(format.validation && format.validation.min !== undefined ? format.validation.min : 1)
  return '这是一次用于云端契约测试的回答。'
}

function completeSession() {
  let session = runtime.createEmptySession(100)
  let timestamp = 200
  runtime.BUNDLE.orderedParentTaskIds.forEach(taskId => {
    runtime.itemEntries(runtime.getTask(taskId)).forEach(entry => {
      session = runtime.answerItem(session, entry.itemId, valueFor(entry), timestamp)
      timestamp += 1
    })
  })
  session.currentTaskIndex = runtime.BUNDLE.orderedParentTaskIds.length - 1
  return session
}

async function run() {
  const full = completeSession()
  const partial = Object.assign({}, full, {
    answerEvents: full.answerEvents.slice(0, 12),
    latestAnswers: runtime.latestAnswersFromEvents(full.answerEvents.slice(0, 12)),
    answers: runtime.latestAnswersFromEvents(full.answerEvents.slice(0, 12)),
    updatedAt: 300
  })
  let result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: partial })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.assessmentType, 'v3-product-v0')
  assert.equal(result.data.session.status, 'synced')

  result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: Object.assign({}, partial, { updatedAt: 250 }) })
  assert.equal(result.ok, true)
  assert.equal(result.data.staleIgnored, true)

  result = await cloudFunction.main({ action: 'assessmentComplete', session: full })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.status, 'completed')
  assert.equal(result.data.report.source, 'THEORY_DRIVEN_PRODUCT_V0')
  assert.equal(result.data.report.reportVersion, 1)
  assert.ok(result.data.report.generatedAt > 0)
  assert.equal(result.data.report.isSynthetic, false)
  assert.ok(result.data.report.contentVersion)
  assert.equal(result.data.report.questionnaireVersion, runtime.BUNDLE.instrument.questionnaireVersion)
  assert.equal(result.data.report.dimensionCards.length, 14)
  const reportId = result.data.report._id

  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: { eventId: 'product-feedback-1', targetType: 'result', targetId: 'overall', value: 'does_not_fit', reasonCode: 'overreached', createdAt: 6000 } })
  assert.equal(result.ok, true)
  assert.equal(result.data.feedbackEvent.targetType, 'result')
  assert.equal(result.data.feedbackEvent.reasonCode, 'overreached')

  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: { eventId: 'product-feedback-1', targetType: 'result', targetId: 'overall', value: 'does_not_fit', reasonCode: 'overreached', createdAt: 6000 } })
  assert.equal(result.data.duplicateIgnored, true)

  result = await cloudFunction.main({ action: 'assessmentFeedbackAppend', reportId, feedbackEvent: { eventId: 'product-feedback-c1', targetType: 'chapter', targetId: 'C1', value: 'fits', reasonCode: '', createdAt: 6001 } })
  assert.equal(result.ok, true)
  assert.equal(result.data.feedbackEvent.targetType, 'chapter')
  assert.ok(result.data.feedbackEvent.contentVersion)
  assert.equal(result.data.feedbackEvent.questionnaireVersion, runtime.BUNDLE.instrument.questionnaireVersion)

  result = await cloudFunction.main({ action: 'assessmentComplete', session: full })
  assert.equal(result.ok, true)
  assert.equal(result.data.duplicateIgnored, true)
  assert.equal(result.data.report._id, reportId)

  result = await cloudFunction.main({ action: 'assessmentGet', assessmentType: 'v3-product-v0' })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.status, 'completed')
  assert.equal(result.data.report._id, reportId)
  assert.equal(result.data.report.feedbackEvents.length, 2)

  const revised = runtime.answerItem(full, 'RR01', 7, 5000)
  result = await cloudFunction.main({ action: 'assessmentSaveDraft', session: revised })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.status, 'synced')
  assert.equal(result.data.session.activeReportId, reportId)

  result = await cloudFunction.main({ action: 'assessmentGet', assessmentType: 'v3-product-v0' })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.status, 'synced')
  assert.equal(result.data.report, null)

  result = await cloudFunction.main({ action: 'assessmentComplete', session: revised })
  assert.equal(result.ok, true)
  assert.equal(result.data.session.status, 'completed')
  assert.equal(result.data.report.reportVersion, 2)
  assert.notEqual(result.data.report._id, reportId)

  result = await cloudFunction.main({ action: 'assessmentHistory', assessmentType: 'v3-product-v0' })
  assert.equal(result.ok, true)
  assert.equal(result.data.reports.length, 2)
  assert.equal(result.data.reports[1]._id, reportId)
  assert.ok(result.data.reports[0].generatedAt > 0)

  result = await cloudFunction.main({ action: 'assessmentDelete', assessmentType: 'v3-product-v0' })
  assert.equal(result.ok, true)
  assert.equal(result.data.productV0Only, true)
  assert.equal(rows('assessment_sessions').size, 0)
  assert.equal(rows('assessment_reports').size, 0)
  console.log('Product v0 cloud OK: immutable answer events, stale protection, report generation, restore, history, and deletion')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
