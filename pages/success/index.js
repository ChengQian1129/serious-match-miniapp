const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  onShow() {
    resetNavigation(this)
  },

  viewProfile() {
    navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
  },

  goHome() {
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  }
})
