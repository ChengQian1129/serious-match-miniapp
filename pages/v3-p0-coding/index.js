const engine = require('../../shared/assessment-v3-p0/runtime-engine')
const store = require('../../utils/assessment-v3-p0/session-store')
const archive = require('../../utils/assessment-v3-p0/research-archive')
const { FEATURES } = require('../../utils/features')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const publicLanguage = require('../../shared/content/public-language.generated')
const p0Copy = publicLanguage.ui.v3P0Research

function asString(value) {
  return value === null || value === undefined ? '' : String(value)
}

function parseIds(value) {
  return asString(value).split(',').map(item => item.trim()).filter(Boolean)
}

function itemPrompt(task, itemId) {
  if (task.children && task.children.length) {
    const child = task.children.find(candidate => candidate.itemId === itemId)
    return child ? child.prompt : task.prompt
  }
  return task.prompt
}

function buildItemList(session) {
  const result = []
  session.assignment.assignedParentTaskIds.forEach(parentTaskId => {
    const task = engine.getResearchTask(parentTaskId)
    engine.expectedItemIdsForParent(parentTaskId).forEach(itemId => result.push({
      itemId,
      parentTaskId,
      prompt: itemPrompt(task, itemId),
      fieldCode: task.constructId,
      probeFocus: task.probeFocus || [],
      answered: Object.prototype.hasOwnProperty.call(session.latestAnswers, itemId),
      missing: session.missingness[itemId] || null,
      coded: Boolean(session.interviewerCodingByItem[itemId]),
      responseStatus: Object.prototype.hasOwnProperty.call(session.latestAnswers, itemId)
        ? p0Copy.missingStatus.answered
        : session.missingness[itemId]
          ? (p0Copy.missingStatus[session.missingness[itemId].code] || p0Copy.missingStatus.unanswered)
          : p0Copy.missingStatus.unanswered,
      codingStatus: session.interviewerCodingByItem[itemId]
        ? p0Copy.missingStatus.coded
        : p0Copy.missingStatus.needsCoding
    }))
  })
  return result
}

function codingDraft(session, itemId) {
  const existing = (session.interviewerCodingByItem || {})[itemId] || {}
  const notes = (session.itemProbeNotes || {})[itemId] || {}
  return {
    comprehension: existing.comprehension || '',
    retrievalBasis: existing.retrievalBasis || '',
    responseMapping: existing.responseMapping || '',
    socialDesirability: existing.socialDesirability || '',
    emotionalSensitivity: existing.emotionalSensitivity || '',
    recommendedAction: existing.recommendedAction || '',
    contaminationText: (existing.constructContamination && existing.constructContamination.suspected || []).join(', '),
    interviewerNote: notes.interviewerNote || '',
    missingOptionNote: notes.missingOptionNote || '',
    paraphraseNote: notes.paraphraseNote || ''
  }
}

function debriefView(session) {
  const debrief = session.waveDebrief || {}
  return {
    hardestItemIds: (debrief.hardestItemIds || []).join(', '),
    repetitiveItemIds: (debrief.repetitiveItemIds || []).join(', '),
    correctAnswerFeelingItemId: debrief.correctAnswerFeelingItemId || '',
    importantUnaskedNote: debrief.importantUnaskedNote || '',
    askedTooEarlyItemId: debrief.askedTooEarlyItemId || '',
    privacySensitiveItemId: debrief.privacySensitiveItemId || '',
    privateInterviewNote: debrief.privateInterviewNote || ''
  }
}

function errorCopy(error) {
  const message = error && error.message ? error.message : String(error || '')
  const fill = (template, count) => String(template || '').replace('{count}', String(count))
  if (message.startsWith('CODING_REQUIRED:')) return fill(p0Copy.errors.codingRequired, message.slice('CODING_REQUIRED:'.length).split(',').filter(Boolean).length)
  if (message === 'DEBRIEF_REQUIRED') return 'Save the wave debrief before completing.'
  if (message === 'DEBRIEF_INCOMPLETE') return 'Choose the item that felt most like it had a correct answer.'
  if (message.includes('INVALID_CODING:')) return `Invalid coding field: ${message.split('INVALID_CODING:')[1]}`
  if (message.includes('INVALID_DEBRIEF')) return 'Check the item IDs in the debrief.'
  if (message.includes('ARCHIVE_SESSION_EXISTS') || message.includes('PARTICIPANT_STUDY_ID_EXISTS')) return 'This session is already archived.'
  return 'Research record could not be saved.'
}

const codingFields = Object.keys(engine.BUNDLE.codingSchema).map(key => ({
  key,
  options: engine.BUNDLE.codingSchema[key].map(value => ({ value, label: value }))
}))

Page({
  data: {
    loaded: false,
    enabled: false,
    blocked: false,
    completed: false,
    waveId: '',
    participantStudyId: '',
    items: [],
    currentItemId: '',
    currentItem: null,
    codingFields,
    coding: codingDraft({}, ''),
    debrief: debriefView({}),
    error: '',
    notice: '',
    exportReady: false,
    exportJson: '',
    startNextButton: p0Copy.startNextButton,
    archiveTitle: p0Copy.archiveTitle,
    archiveDescription: p0Copy.archiveDescription
  },

  onLoad(options = {}) {
    if (!FEATURES.v3P0Research) {
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      return
    }
    this._loaded = true
    this._requestedItemId = options.itemId || ''
    this.refresh()
  },

  onShow() {
    resetNavigation(this)
    if (this._loaded) this.refresh()
  },

  refresh() {
    const session = store.getSession()
    if (!session) {
      if (this.data.completed) {
        this.setData({ loaded: true, enabled: true, blocked: false, completed: true })
        return
      }
      this.setData({ loaded: true, enabled: true, blocked: true, error: 'No active P0 session.' })
      return
    }
    const items = buildItemList(session)
    const requested = this._requestedItemId && items.some(item => item.itemId === this._requestedItemId) ? this._requestedItemId : ''
    const firstUncoded = items.find(item => (item.answered || item.missing) && !item.coded)
    const currentItemId = requested || this.data.currentItemId || (firstUncoded ? firstUncoded.itemId : '') || (items.length ? items[0].itemId : '')
    const currentItem = items.find(item => item.itemId === currentItemId) || null
    this.setData({
      loaded: true,
      enabled: true,
      blocked: false,
      completed: session.status === 'completed_no_scoring',
      waveId: session.waveId,
      participantStudyId: session.participantStudyId,
      items,
      currentItemId,
      currentItem,
      coding: codingDraft(session, currentItemId),
      debrief: debriefView(session),
      error: '',
      notice: ''
    })
    this._requestedItemId = ''
  },

  selectItem(event) {
    const itemId = event.currentTarget.dataset.itemId
    const session = store.getSession()
    const items = buildItemList(session)
    const currentItem = items.find(item => item.itemId === itemId) || null
    this.setData({ currentItemId: itemId, currentItem, coding: codingDraft(session, itemId), error: '', notice: '' })
  },

  chooseCoding(event) {
    const field = event.currentTarget.dataset.field
    const value = event.currentTarget.dataset.value
    this.setData({ [`coding.${field}`]: value, error: '' })
  },

  inputCoding(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`coding.${field}`]: event.detail.value, error: '' })
  },

  inputDebrief(event) {
    this.setData({ [`debrief.${event.currentTarget.dataset.field}`]: event.detail.value, error: '' })
  },

  saveCoding() {
    if (!this.data.currentItemId) return
    const coding = Object.assign({}, this.data.coding, {
      constructContamination: { suspected: parseIds(this.data.coding.contaminationText) }
    })
    try {
      store.saveItemCoding(this.data.currentItemId, coding, this.data.coding)
      this.setData({ notice: 'Coding saved.', error: '' })
      this.refresh()
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
    }
  },

  saveProbeNotes() {
    if (!this.data.currentItemId) return
    try {
      store.saveItemProbeNotes(this.data.currentItemId, this.data.coding)
      this.setData({ notice: 'Probe notes saved.', error: '' })
      this.refresh()
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
    }
  },

  saveDebrief() {
    try {
      const value = this.data.debrief
      store.saveWaveDebrief({
        hardestItemIds: parseIds(value.hardestItemIds),
        repetitiveItemIds: parseIds(value.repetitiveItemIds),
        correctAnswerFeelingItemId: value.correctAnswerFeelingItemId,
        importantUnaskedNote: value.importantUnaskedNote,
        askedTooEarlyItemId: value.askedTooEarlyItemId,
        privacySensitiveItemId: value.privacySensitiveItemId,
        privateInterviewNote: value.privateInterviewNote
      })
      this.setData({ notice: 'Debrief saved.', error: '' })
      this.refresh()
      return true
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
      return false
    }
  },

  completeInterview() {
    if (!this.saveDebrief()) return
    try {
      const completed = store.completeSession()
      archive.completeAndArchiveSession(completed)
      this.setData({ completed: true, blocked: false, notice: 'Completed and archived.', error: '' })
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
    }
  },

  exportArchive() {
    try {
      const json = archive.exportArchiveJson()
      if (typeof wx !== 'undefined' && wx && typeof wx.setClipboardData === 'function') wx.setClipboardData({ data: json })
      this.setData({ exportReady: true, exportJson: json, notice: 'Versioned export prepared.', error: '' })
    } catch (error) {
      this.setData({ error: errorCopy(error), notice: '' })
    }
  },

  backToResearch() {
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/v3-p0-research/index' }) })
  },

  exitResearch() {
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  startNextInterview() {
    navigateOnce(this, 'reLaunch', { url: '/pages/v3-p0-research/index' })
  }
})

module.exports = { buildItemList, codingDraft, debriefView, parseIds, errorCopy }
