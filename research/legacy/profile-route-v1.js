function draftProfileRoute(profile) {
  const routes = {
    1: '/pages/onboarding-basic/index',
    2: '/pages/onboarding-relationship/index',
    3: '/pages/onboarding-about/index',
    4: '/pages/onboarding-about/index'
  }
  const route = routes[profile && profile.currentStep] || routes[1]
  const question = profile && profile.currentStep === 4
    ? 4
    : profile && Number.isInteger(profile.currentQuestion) ? profile.currentQuestion : 0
  return `${route}?question=${question}`
}

module.exports = { draftProfileRoute }
