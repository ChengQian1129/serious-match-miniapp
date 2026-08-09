const { getChapter, getItem, optionsFor } = require('./questionnaire-definitions')
const { evaluateAssessment, scored, missing } = require('./scoring-engine')
const { buildReport } = require('./report-engine')
const { CONTENT_VERSION } = require('../../shared/content/version')
const publicLanguage = require('../../shared/content/public-language.generated')

const PRESENT = new Set(['strong_present', 'lean_present'])
const LESS = new Set(['strong_less', 'lean_less'])
const publicV2Copy = publicLanguage.v2 || {}
const reportFallbackCopy = publicV2Copy.reportFallback || {}

function fallbackNarrative() {
  const fallback = publicV2Copy.chapterInsightFallback || {}
  return { headline: fallback.title || '', summary: fallback.text || '' }
}

function answerEvidence(chapter, answers) {
  return chapter.itemIds.map((itemId, index) => {
    const item = getItem(itemId)
    const rawValue = answers[itemId]
    if (!item || missing(rawValue)) return null
    const option = optionsFor(item).find(current => current.value === rawValue)
    return {
      itemId,
      question: item.publicText || item.text,
      answer: option ? option.label : reportFallbackCopy.answerUnavailable,
      strength: Math.abs(scored(item, rawValue) - 3),
      index
    }
  }).filter(Boolean).sort((left, right) => right.strength - left.strength || left.index - right.index).slice(0, 3)
}

function publicChapterNarrative(chapterId, evaluation) {
  const dimensions = evaluation.dimensions
  const publicCopy = publicV2Copy.chapterNarrativePublic || {}
  const state = (chapter, key) => publicCopy[chapter] && publicCopy[chapter][key]
  if (chapterId === 'C1') {
    const willingness = PRESENT.has(dimensions.readiness_intent.state)
    const selfDirected = PRESENT.has(dimensions.autonomous_motivation.state)
    const key = willingness && selfDirected ? 'willing_self_directed' : willingness ? 'willing_with_pressure' : LESS.has(dimensions.readiness_intent.state) ? 'hesitant' : 'mixed'
    return state('C1', key) || fallbackNarrative()
  }
  if (chapterId === 'C2') {
    const key = PRESENT.has(dimensions.available_capacity.state) ? 'capacity_present' : LESS.has(dimensions.available_capacity.state) ? 'capacity_low' : 'capacity_mixed'
    return state('C2', key) || fallbackNarrative()
  }
  if (chapterId === 'C3') {
    const key = PRESENT.has(dimensions.uncertainty_sensitivity.state) ? 'sensitivity_present' : LESS.has(dimensions.uncertainty_sensitivity.state) ? 'sensitivity_low' : 'sensitivity_mixed'
    return state('C3', key) || fallbackNarrative()
  }
  if (chapterId === 'C4') {
    const key = PRESENT.has(dimensions.closeness_discomfort.state) ? 'closeness_discomfort_present' : LESS.has(dimensions.closeness_discomfort.state) ? 'closeness_discomfort_low' : 'closeness_discomfort_mixed'
    return state('C4', key) || fallbackNarrative()
  }
  return publicCopy[chapterId] && publicCopy[chapterId].default || fallbackNarrative()
}

function buildChapterInsight(chapterId, answers, options = {}) {
  const chapter = getChapter(chapterId)
  if (!chapter) throw new Error('Unknown chapter')
  const evaluation = evaluateAssessment(answers)
  const report = options.report && Array.isArray(options.report.allClaimCandidates) ? options.report : buildReport(answers)
  const sourceSet = new Set(chapter.itemIds)
  const relevant = report.allClaimCandidates.filter(claim => [].concat(claim.supportingItemIds || [], claim.contradictingItemIds || [], claim.qualifyingItemIds || []).some(id => sourceSet.has(id))).slice(0, 3)
  const narrative = publicChapterNarrative(chapterId, evaluation)
  const chapterTitles = publicV2Copy.chapterTitles || {}
  return {
    chapterId,
    chapterTitle: chapterTitles[chapterId] || chapter.title,
    headline: narrative.headline,
    summary: narrative.summary,
    contentVersion: CONTENT_VERSION,
    evidence: answerEvidence(chapter, answers),
    claims: relevant
  }
}

module.exports = { buildChapterInsight }
