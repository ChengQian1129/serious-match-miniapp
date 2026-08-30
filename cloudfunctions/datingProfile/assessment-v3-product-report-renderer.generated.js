const PUBLIC_LANGUAGE = require('./public-language.generated')
const { CHAPTERS, DIMENSION_IDS, assertDerivedV3Profile, clone } = require('./assessment-v3-product-contract.generated')
const { deriveEligiblePatternIds } = require('./assessment-v3-product-pattern-eligibility.generated')

const PRODUCT_COPY = PUBLIC_LANGUAGE.v3.product
const PRODUCT_V0_COPY = Object.assign({}, PRODUCT_COPY, {
  preview: Object.assign({}, PRODUCT_COPY.preview, PUBLIC_LANGUAGE.v3.productV0 && PUBLIC_LANGUAGE.v3.productV0.real && PUBLIC_LANGUAGE.v3.productV0.real.preview),
  method: Object.assign({}, PRODUCT_COPY.method, PUBLIC_LANGUAGE.v3.productV0 && PUBLIC_LANGUAGE.v3.productV0.real && PUBLIC_LANGUAGE.v3.productV0.real.method),
  evidence: Object.assign({}, PRODUCT_COPY.evidence, PUBLIC_LANGUAGE.v3.productV0 && PUBLIC_LANGUAGE.v3.productV0.real && PUBLIC_LANGUAGE.v3.productV0.real.evidence)
})
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

function copyForProfile(profile) {
  return profile && profile.source === 'THEORY_DRIVEN_PRODUCT_V0' ? PRODUCT_V0_COPY : PRODUCT_COPY
}

function confidencePrefix(result, copy = PRODUCT_COPY) {
  if (result.evidenceStatus === 'PROVISIONAL') return copy.confidence.provisionalPrefix
  return copy.confidence[`${String(result.confidence || '').toLowerCase()}Prefix`] || ''
}

function narrativeForDimension(dimensionId, result, copy = PRODUCT_COPY) {
  if (!result || result.resultStatus === 'INSUFFICIENT') {
    return {
      headline: copy.fallback.insufficientDimensionHeadline || copy.fallback.dimensionHeadline,
      summary: copy.fallback.insufficientDimensionSummary || copy.fallback.dimensionSummary
    }
  }
  const narrative = NARRATIVES.dimensions[dimensionId] && NARRATIVES.dimensions[dimensionId][result.state]
  if (narrative && narrative.headline) return narrative
  return { headline: copy.fallback.dimensionHeadline, summary: copy.fallback.dimensionSummary }
}

function narrativeForChapter(chapterId, state, copy = PRODUCT_COPY) {
  const narrative = NARRATIVES.chapters[chapterId] && NARRATIVES.chapters[chapterId][state]
  if (narrative && narrative.headline) return narrative
  return { headline: copy.fallback.chapterHeadline, summary: copy.fallback.chapterSummary }
}

function narrativeForPattern(patternId, copy = PRODUCT_COPY) {
  const narrative = NARRATIVES.crossChapterPatterns[patternId]
  if (narrative && narrative.headline) return narrative
  return { headline: copy.fallback.patternHeadline, summary: copy.fallback.patternSummary }
}

function evidenceLabel(role, copy = PRODUCT_COPY) {
  const key = role === 'qualifying' ? 'qualifyingLabel' : role === 'contradicting' ? 'contradictingLabel' : 'supportingLabel'
  return copy.evidence[key]
}

function publicResponseForEvidence(entry, copy = PRODUCT_COPY) {
  if (entry && entry.question && entry.answer) {
    return {
      question: entry.question,
      answer: entry.answer,
      label: evidenceLabel(entry.role, copy),
      source: copy.evidence.sourceNote
    }
  }
  return {
    question: entry.question || entry.taskId || '',
    answer: entry.answer || entry.answerText || String(entry.answerCode || ''),
    label: evidenceLabel(entry.role, copy),
    source: copy.evidence.sourceNote
  }
}

function dimensionCard(profile, dimensionId, copy = copyForProfile(profile)) {
  const result = profile.dimensionResults[dimensionId]
  const narrative = narrativeForDimension(dimensionId, result, copy)
  const evidence = (result.evidence || []).map(entry => publicResponseForEvidence(entry, copy)).filter(Boolean)
  return {
    id: dimensionId,
    title: objectAt(copy, `dimensions.${dimensionId}.label`) || copy.fallback.dimensionHeadline,
    headline: `${confidencePrefix(result, copy)}${narrative.headline}`,
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

function c3Narrative(profile, copy = PRODUCT_COPY) {
  const state = profile && profile.chapterStates && profile.chapterStates.C3
  if (!state) return { headline: copy.fallback.chapterHeadline, summary: copy.fallback.chapterSummary }
  const compositions = NARRATIVES.chapterCompositions && NARRATIVES.chapterCompositions.C3
  const activation = compositions && compositions.activation && compositions.activation[state.activation]
  const primary = compositions && compositions.strategy && compositions.strategy[state.primaryStrategy]
  if (!activation || !primary) return { headline: copy.fallback.chapterHeadline, summary: copy.fallback.chapterSummary }
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

function chapterSynthesis(profile, chapter, copy = copyForProfile(profile)) {
  const narrative = chapter.id === 'C3'
    ? c3Narrative(profile, copy)
    : narrativeForChapter(chapter.id, profile.chapterStates[chapter.id], copy)
  return {
    id: chapter.id,
    title: NARRATIVES.reportTitles[chapter.id] || NARRATIVES.chapters[chapter.id].label,
    intro: copy.chapters[chapter.id].intro,
    headline: narrative.headline,
    summary: narrative.summary,
    dimensionIds: chapter.dimensionIds.slice(),
    transition: copy.chapters[chapter.id].transition
  }
}

function decisionSection(profile, key, copy = copyForProfile(profile)) {
  const source = profile.decisionMap[key] || { items: [] }
  const sectionCopy = copy.decisions[key]
  return {
    id: key,
    title: sectionCopy.title,
    intro: sectionCopy.intro,
    items: (source.items || []).map(item => {
      const itemCopy = sectionCopy.items[item.copyKey]
      if (!itemCopy) return null
      const valueCopy = copy.decisionValues && copy.decisionValues[key] && copy.decisionValues[key][item.copyKey] && copy.decisionValues[key][item.copyKey][item.valueKey]
      return Object.assign({ id: item.copyKey }, itemCopy, valueCopy ? { detail: valueCopy } : {})
    }).filter(Boolean)
  }
}

function unknownItems(profile, copy = copyForProfile(profile)) {
  return (profile.unknowns || []).map(key => {
    const item = copy.unknowns.items[key]
    return item ? Object.assign({ id: key }, item) : null
  }).filter(Boolean)
}

function interviewItems(profile, copy = copyForProfile(profile)) {
  return (profile.interviewPriorities || []).map(priority => {
    const item = copy.interview.items[priority.copyKey]
    if (!item) return null
    return Object.assign({ id: priority.copyKey, dimensionId: priority.dimensionId || '' }, item)
  }).filter(Boolean)
}

function buildReport(profileInput) {
  const profile = clone(profileInput)
  assertDerivedV3Profile(profile)
  const copy = copyForProfile(profile)
  const dimensionCards = DIMENSION_IDS.map(dimensionId => dimensionCard(profile, dimensionId, copy))
  const chapters = CHAPTERS.map(chapter => chapterSynthesis(profile, chapter, copy))
  const summaryPatterns = selectSummaryPatterns(profile)
  return {
    contractVersion: 'v3.product-report.v1.0',
    source: profile.source,
    isSynthetic: profile.isSynthetic,
    personaId: profile.persona && profile.persona.id ? profile.persona.id : (profile.assessmentMeta && profile.assessmentMeta.assessmentId) || '',
    assessmentMeta: clone(profile.assessmentMeta),
    title: NARRATIVES.reportTitles.cover,
    notice: copy.preview.reportNotice,
    executiveSummary: {
      title: copy.preview.reportSummaryTitle,
      patterns: summaryPatterns,
      unknownPreview: unknownItems(profile, copy).slice(0, 1)
    },
    dimensionCards,
    chapterSyntheses: chapters,
    decisionMap: {
      title: copy.preview.reportDecisionTitle,
      sections: ['l3', 'l4', 'l5'].map(key => decisionSection(profile, key, copy))
    },
    unknowns: {
      title: copy.preview.reportUnknownTitle,
      description: copy.unknowns.description,
      items: unknownItems(profile, copy)
    },
    interviewPriorities: {
      title: copy.preview.reportInterviewTitle,
      description: copy.interview.description,
      optional: copy.interview.optional,
      items: interviewItems(profile, copy)
    },
    methodNote: {
      title: copy.preview.reportMethodTitle,
      body: copy.method.body,
      structure: copy.method.structure,
      privacy: copy.method.privacy
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
  const copy = report && report.source === 'THEORY_DRIVEN_PRODUCT_V0' ? PRODUCT_V0_COPY : PRODUCT_COPY
  return {
    title: card.title,
    headline: card.headline,
    summary: card.summary,
    evidence: card.evidence,
    sourceNote: copy.evidence.sourceNote,
    empty: copy.evidence.unavailable
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
  PRODUCT_V0_COPY,
  PATTERN_SUPPRESSION,
  c3Narrative
}
