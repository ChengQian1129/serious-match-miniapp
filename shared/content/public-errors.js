const { publicErrors } = require('./public-language.generated')

function publicError(key) {
  return publicErrors[key] || publicErrors.generic
}

function classifyError(error, fallback = 'generic') {
  const code = String(error && error.code || '')
  const detail = String(error && (error.errMsg || error.message) || '').toLowerCase()
  if (code === 'INCOMPLETE_ASSESSMENT' || detail.includes('未完成') || detail.includes('incomplete')) return publicError('incomplete')
  if (code === 'NETWORK_ERROR' || detail.includes('network') || detail.includes('timeout') || detail.includes('网络')) return publicError('network')
  if (code === 'INVALID_ASSESSMENT' || code === 'INVALID_RESPONSE' || detail.includes('无效')) return publicError('questionInvalid')
  if (code === 'CLOUD_RESPONSE_ERROR' || code === 'CLOUD_NOT_READY' || code === 'SERVER_ERROR') return publicError(fallback)
  return publicError(fallback)
}

module.exports = { publicError, classifyError }
