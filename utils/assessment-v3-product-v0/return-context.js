const SOURCES = Object.freeze(['result', 'partial-result', 'evidence', 'answer-review'])
const DEFAULT_RESULT_URL = '/pages/v3-result/index?mode=product-v0'

function safeId(value, maxLength = 120) {
  const text = String(value || '').trim()
  return /^[A-Za-z0-9_.-]+$/.test(text) ? text.slice(0, maxLength) : ''
}

function normalizeReturnContext(input = {}, fallback = {}) {
  const source = SOURCES.includes(input.source) ? input.source : (SOURCES.includes(fallback.source) ? fallback.source : 'result')
  const targetId = safeId(input.targetId || fallback.targetId)
  const scrollAnchor = safeId(input.scrollAnchor || fallback.scrollAnchor)
  const parsedVersion = Number(input.reportVersion !== undefined ? input.reportVersion : fallback.reportVersion)
  return {
    source,
    targetId,
    scrollAnchor,
    reportVersion: Number.isFinite(parsedVersion) && parsedVersion >= 0 ? Math.floor(parsedVersion) : 0
  }
}

function encodeReturnContext(context, fallback) {
  return encodeURIComponent(JSON.stringify(normalizeReturnContext(context, fallback)))
}

function decodeURIComponentSafely(value) {
  let decoded = String(value || '')
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch (error) {
      break
    }
  }
  return decoded
}

function queryValue(url, key) {
  const match = String(url || '').match(new RegExp(`[?&]${key}=([^&]*)`))
  return match ? decodeURIComponentSafely(match[1]) : ''
}

function contextFromLegacyUrl(url, fallback = {}) {
  const value = decodeURIComponentSafely(url)
  if (value.includes('/pages/v3-result-evidence/index')) {
    return normalizeReturnContext({ source: 'evidence', targetId: queryValue(value, 'dimension') }, fallback)
  }
  if (value.includes('/pages/v3-answer-review/index')) {
    return normalizeReturnContext({ source: 'answer-review', targetId: queryValue(value, 'section') }, fallback)
  }
  if (value.includes('/pages/v3-result/index')) {
    return normalizeReturnContext({ source: queryValue(value, 'scope') === 'partial' ? 'partial-result' : 'result' }, fallback)
  }
  return normalizeReturnContext(fallback)
}

function decodeReturnContext(raw, fallback = {}) {
  if (!raw) return normalizeReturnContext(fallback)
  if (typeof raw === 'object') return normalizeReturnContext(raw, fallback)
  const decoded = decodeURIComponentSafely(raw)
  try {
    const parsed = JSON.parse(decoded)
    return normalizeReturnContext(parsed, fallback)
  } catch (error) {
    return contextFromLegacyUrl(decoded, fallback)
  }
}

function resolveReturnContext(options = {}, fallback = {}) {
  return decodeReturnContext(options.returnContext || options.returnTo, fallback)
}

function resultUrl(context = {}) {
  const normalized = normalizeReturnContext(context)
  const base = normalized.source === 'partial-result' ? `${DEFAULT_RESULT_URL}&scope=partial` : DEFAULT_RESULT_URL
  if (!normalized.targetId && !normalized.scrollAnchor && !normalized.reportVersion) return base
  return `${base}&returnContext=${encodeReturnContext(normalized)}`
}

function contextUrl(context = {}) {
  const normalized = normalizeReturnContext(context)
  if (normalized.source === 'evidence' && normalized.targetId) {
    return `/pages/v3-result-evidence/index?mode=product-v0&dimension=${encodeURIComponent(normalized.targetId)}&returnContext=${encodeReturnContext(normalized)}`
  }
  if (normalized.source === 'answer-review') {
    const section = normalized.targetId ? `&section=${encodeURIComponent(normalized.targetId)}` : ''
    return `/pages/v3-answer-review/index?mode=product-v0${section}&returnContext=${encodeReturnContext(normalized)}`
  }
  return resultUrl(normalized)
}

function questionnaireEditUrl(taskId, context = {}) {
  const id = safeId(taskId)
  if (!id) return ''
  return `/pages/questionnaire-v3/index?taskId=${encodeURIComponent(id)}&mode=edit&returnContext=${encodeReturnContext(context)}`
}

function parentResultUrl(context = {}, isPartial = false) {
  const normalized = normalizeReturnContext(context)
  const clearReviewAnchor = normalized.source === 'answer-review'
  const evidenceAnchor = normalized.source === 'evidence' && normalized.targetId ? `dimension-${normalized.targetId}` : normalized.scrollAnchor
  return resultUrl(Object.assign({}, normalized, {
    source: isPartial ? 'partial-result' : 'result',
    targetId: clearReviewAnchor ? '' : normalized.targetId,
    scrollAnchor: clearReviewAnchor ? '' : evidenceAnchor
  }))
}

module.exports = {
  SOURCES,
  DEFAULT_RESULT_URL,
  safeId,
  normalizeReturnContext,
  encodeReturnContext,
  decodeReturnContext,
  resolveReturnContext,
  contextFromLegacyUrl,
  resultUrl,
  contextUrl,
  questionnaireEditUrl,
  parentResultUrl
}
