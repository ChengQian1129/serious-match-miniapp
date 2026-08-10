const PUBLIC_LANGUAGE = require('../content/public-language.generated')
const runtime = require('../assessment-v3-pilot/runtime-engine')
const { CHAPTERS, DIMENSION_IDS, assertDerivedV3Profile, clone } = require('./contract')
const { deriveEligiblePatternIds } = require('./pattern-eligibility')

const PRODUCT_COPY = PUBLIC_LANGUAGE.v3.product
const NARRATIVES = PUBLIC_LANGUAGE.v3.narratives

const PATTERN_SUPPRESSION = Object.freeze({
  PRESSURE_CAPACITY_GAP: ['READINESS_CAPACITY_GAP'],
  HIGH_ACTIVATION_REASSURANCE: ['HIGH_ACTIVATION_LOW_SIGNAL'],
  RESPONSIVE_SELF_SILENT: ['SUPPORT_NEED_SIGNAL_GAP'],
  CONFLICT_HIGH_REPAIR_HIGH: ['SPACE_PACING_SHARED']
})

function objectAt(root, path) {
  return String(path).split('.').reduce((value, key) => value && value[key], root)
}

function confidencePrefix(result) {
  if (result.evidenceStatus === 'PROVISIONAL') return PRODUCT_COPY.confidence.provisionalPrefix
  return PRODUCT_COPY.confidence[`${String(result.confidence || '').toLowerCase()}Prefix`] || ''
}

function narrativeForDimension(dimensionId, result) {
  if (!result || result.resultStatus === 'INSUFFICIENT') {
    return {
      headline: PRODUCT_COPY.fallback.insufficientDimensionHeadline || PRODUCT_COPY.fallback.dimensionHeadline,
      summary: PRODUCT_COPY.fallback.insufficientDimensionSummary || PRODUCT_COPY.fallback.dimensionSummary
    }
  }
  const narrative = NARRATIVES.dimensions[dimensionId] && NARRATIVES.dimensions[dimensionId][result.state]
  if (narrative && narrative.headline) return narrative
  return { headline: PRODUCT_COPY.fallback.dimensionHeadline, summary: PRODUCT_COPY.fallback.dimensionSummary }
}

function narrativeForChapter(chapterId, state) {
  const narrative = NARRATIVES.chapters[chapterId] && NARRATIVES.chapters[chapterId][state]
  if (narrative && narrative.headline) return narrative
  return { headline: PRODUCT_COPY.fallback.chapterHeadline, summary: PRODUCT_COPY.fallback.chapterSummary }
}

function narrativeForPattern(patternId) {
  const narrative = NARRATIVES.crossChapterPatterns[patternId]
  if (narrative && narrative.headline) return narrative
  return { headline: PRODUCT_COPY.fallback.patternHeadline, summary: PRODUCT_COPY.fallback.patternSummary }
}

function evidenceLabel(role) {
  const key = role === 'qualifying' ? 'qualifyingLabel' : role === 'contradicting' ? 'contradictingLabel' : 'supportingLabel'
  return PRODUCT_COPY.evidence[key]
}

function publicResponseForEvidence(entry) {
  if (entry && entry.question && entry.answer) {
    return {
      question: entry.question,
      answer: entry.answer,
      label: evidenceLabel(entry.role),
      source: PRODUCT_COPY.evidence.sourceNote
    }
  }
  const task = runtime.getPublicTask(entry.taskId)
  if (!task) return null
  const item = entry.itemId && task.children
    ? task.children.find(child => child.itemId === entry.itemId)
    : task
  if (!item) return null
  const format = runtime.resolvePublicFormat(item.response, item.itemId, task.taskId)
  const option = format && Array.isArray(format.options)
    ? format.options.find(candidate => String(candidate.code) === String(entry.answerCode))
    : null
  return {
    question: item.prompt || task.prompt || '',
    answer: option ? option.label : (entry.answerText || String(entry.answerCode || '')),
    label: evidenceLabel(entry.role),
    source: PRODUCT_COPY.evidence.sourceNote
  }
}

function dimensionCard(profile, dimensionId) {
  const result = profile.dimensionResults[dimensionId]
  const narrative = narrativeForDimension(dimensionId, result)
  const evidence = (result.evidence || []).map(publicResponseForEvidence).filter(Boolean)
  return {
    id: dimensionId,
    title: objectAt(PRODUCT_COPY, `dimensions.${dimensionId}.label`) || PRODUCT_COPY.fallback.dimensionHeadline,
    headline: `${confidencePrefix(result)}${narrative.headline}`,
    summary: narrative.summary,
    evidence,
    evidenceAvailable: evidence.length > 0,
    resultStatus: result.resultStatus || 'ESTIMATED',
    evidenceStatus: result.evidenceStatus || 'MEASURED'
  }
}

function selectSummaryPatterns(profile) {
  const selected = []
  const seen = new Set()
  const eligiblePatternIds = profile && profile.dimensionResults && profile.patternContext
    ? deriveEligiblePatternIds(profile)
    : []
  eligiblePatternIds.forEach(patternId => {
    if (selected.length >= 3 || seen.has(patternId)) return
    if (selected.some(item => (PATTERN_SUPPRESSION[item.id] || []).includes(patternId))) return
    const suppressedByCurrent = PATTERN_SUPPRESSION[patternId] || []
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (suppressedByCurrent.includes(selected[index].id)) selected.splice(index, 1)
    }
    const narrative = NARRATIVES.crossChapterPatterns[patternId]
    if (!narrative || !narrative.headline) return
    selected.push({ id: patternId, headline: narrative.headline, summary: narrative.summary })
    seen.add(patternId)
  })
  return selected
}

function c3Narrative(profile) {
  const state = profile && profile.chapterStates && profile.chapterStates.C3
  if (!state) return { headline: PRODUCT_COPY.fallback.chapterHeadline, summary: PRODUCT_COPY.fallback.chapterSummary }
  const compositions = NARRATIVES.chapterCompositions && NARRATIVES.chapterCompositions.C3
  const activation = compositions && compositions.activation && compositions.activation[state.activation]
  const primary = compositions && compositions.strategy && compositions.strategy[state.primaryStrategy]
  if (!activation || !primary) return { headline: PRODUCT_COPY.fallback.chapterHeadline, summary: PRODUCT_COPY.fallback.chapterSummary }
  const connectors = compositions.connectors || {}
  let headline = `${activation.headline}${connectors.headline || ''}${primary.headline}`
  let summary = `${activation.summary}${connectors.summary || ''}${primary.summary}`
  if (state.secondaryStrategy && state.secondaryStrategy !== state.primaryStrategy) {
    const secondary = compositions.strategy[state.secondaryStrategy]
    if (secondary) {
      headline += `${connectors.secondaryHeadline || connectors.headline || ''}${secondary.headline}`
      summary += `${connectors.secondarySummary || ''}${secondary.summary}`
    }
  }
  return { headline, summary }
}

function chapterSynthesis(profile, chapter) {
  const narrative = chapter.id === 'C3'
    ? c3Narrative(profile)
    : narrativeForChapter(chapter.id, profile.chapterStates[chapter.id])
  return {
    id: chapter.id,
    title: NARRATIVES.reportTitles[chapter.id] || NARRATIVES.chapters[chapter.id].label,
    intro: PRODUCT_COPY.chapters[chapter.id].intro,
    headline: narrative.headline,
    summary: narrative.summary,
    dimensionIds: chapter.dimensionIds.slice(),
    transition: PRODUCT_COPY.chapters[chapter.id].transition
  }
}

function decisionSection(profile, key) {
  const source = profile.decisionMap[key] || { items: [] }
  const copy = PRODUCT_COPY.decisions[key]
  return {
    id: key,
    title: copy.title,
    intro: copy.intro,
    items: (source.items || []).map(item => {
      const itemCopy = copy.items[item.copyKey]
      if (!itemCopy) return null
      const valueCopy = PRODUCT_COPY.decisionValues && PRODUCT_COPY.decisionValues[key] && PRODUCT_COPY.decisionValues[key][item.copyKey] && PRODUCT_COPY.decisionValues[key][item.copyKey][item.valueKey]
      return Object.assign({ id: item.copyKey }, itemCopy, valueCopy ? { detail: valueCopy } : {})
    }).filter(Boolean)
  }
}

function unknownItems(profile) {
  return (profile.unknowns || []).map(key => {
    const item = PRODUCT_COPY.unknowns.items[key]
    return item ? Object.assign({ id: key }, item) : null
  }).filter(Boolean)
}

function interviewItems(profile) {
  return (profile.interviewPriorities || []).map(priority => {
    const item = PRODUCT_COPY.interview.items[priority.copyKey]
    if (!item) return null
    return Object.assign({ id: priority.copyKey, dimensionId: priority.dimensionId || '' }, item)
  }).filter(Boolean)
}

function buildReport(profileInput) {
  const profile = clone(profileInput)
  assertDerivedV3Profile(profile)
  const dimensionCards = DIMENSION_IDS.map(dimensionId => dimensionCard(profile, dimensionId))
  const chapters = CHAPTERS.map(chapter => chapterSynthesis(profile, chapter))
  const summaryPatterns = selectSummaryPatterns(profile)
  return {
    contractVersion: 'v3.product-report.v1.0',
    source: profile.source,
    isSynthetic: profile.isSynthetic,
    personaId: profile.persona && profile.persona.id ? profile.persona.id : (profile.assessmentMeta && profile.assessmentMeta.assessmentId) || '',
    assessmentMeta: clone(profile.assessmentMeta),
    title: NARRATIVES.reportTitles.cover,
    notice: PRODUCT_COPY.preview.reportNotice,
    executiveSummary: {
      title: PRODUCT_COPY.preview.reportSummaryTitle,
      patterns: summaryPatterns,
      unknownPreview: unknownItems(profile).slice(0, 1)
    },
    dimensionCards,
    chapterSyntheses: chapters,
    decisionMap: {
      title: PRODUCT_COPY.preview.reportDecisionTitle,
      sections: ['l3', 'l4', 'l5'].map(key => decisionSection(profile, key))
    },
    unknowns: {
      title: PRODUCT_COPY.preview.reportUnknownTitle,
      description: PRODUCT_COPY.unknowns.description,
      items: unknownItems(profile)
    },
    interviewPriorities: {
      title: PRODUCT_COPY.preview.reportInterviewTitle,
      description: PRODUCT_COPY.interview.description,
      optional: PRODUCT_COPY.interview.optional,
      items: interviewItems(profile)
    },
    methodNote: {
      title: PRODUCT_COPY.preview.reportMethodTitle,
      body: PRODUCT_COPY.method.body,
      structure: PRODUCT_COPY.method.structure,
      privacy: PRODUCT_COPY.method.privacy
    }
  }
}

function getDimensionCard(report, dimensionId) {
  return (report && report.dimensionCards || []).find(card => card.id === dimensionId) || null
}

function buildChapterView(report, chapterId) {
  const chapter = (report && report.chapterSyntheses || []).find(item => item.id === chapterId) || null
  if (!chapter) return null
  return Object.assign({}, chapter, { dimensionCards: chapter.dimensionIds.map(id => getDimensionCard(report, id)).filter(Boolean) })
}

function buildEvidenceView(report, dimensionId) {
  const card = getDimensionCard(report, dimensionId)
  if (!card) return null
  return {
    title: card.title,
    headline: card.headline,
    summary: card.summary,
    evidence: card.evidence,
    sourceNote: PRODUCT_COPY.evidence.sourceNote,
    empty: PRODUCT_COPY.evidence.unavailable
  }
}

module.exports = {
  buildReport,
  buildChapterView,
  buildEvidenceView,
  dimensionCard,
  selectSummaryPatterns,
  publicResponseForEvidence,
  PRODUCT_COPY,
  PATTERN_SUPPRESSION,
  c3Narrative
}
