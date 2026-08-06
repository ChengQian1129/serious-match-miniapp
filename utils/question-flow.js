function getQuestionIndex(query, fallback, questionCount) {
  const requested = Number(query && query.question)
  if (Number.isInteger(requested) && requested >= 0 && requested < questionCount) {
    return requested
  }

  return fallback
}

function getMotionClass(direction) {
  if (direction === 'back') return 'question-content--enter-back'
  if (direction === 'forward') return 'question-content--enter-forward'
  return ''
}

function acceptNavigationTap(page, event, direction) {
  const eventTime = event && Number(event.timeStamp)
  const now = Number.isFinite(eventTime) ? eventTime : Date.now()
  const key = direction === 'back' ? '_lastBackTapAt' : '_lastContinueTapAt'
  const previous = page[key]
  if (Number.isFinite(previous) && now - previous < 280) return false
  page[key] = now
  return true
}

function showQuestion(page, index, questionCount, direction) {
  if (index < 0 || index >= questionCount) return false

  const motionClass = getMotionClass(direction)

  page.setData(Object.assign({
    currentQuestion: index,
    motionClass: ''
  }, page.getQuestionState(index, page.data.form)), () => {
    wx.pageScrollTo({ scrollTop: 0, duration: 0 })
    wx.nextTick(() => page.setData({ motionClass }))
  })

  return true
}

module.exports = {
  acceptNavigationTap,
  getQuestionIndex,
  getMotionClass,
  showQuestion
}
