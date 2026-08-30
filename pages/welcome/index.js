const { hasSeenWelcome, markWelcomeSeen, recordEvent } = require('../../utils/storage')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { getStatusBarHeight } = require('../../utils/window')
const { welcome, guide, CONTENT_VERSION } = require('../../shared/content/ui-copy')

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    contentVersion: CONTENT_VERSION,
    welcome,
    guide,
    showMethod: false,
    privacyAction: welcome.privacyAction
  },

  onShow() {
    resetNavigation(this)
    if (hasSeenWelcome()) {
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      return
    }
    recordEvent('welcome_view')
  },

  begin() {
    if (this._isRouting) return
    markWelcomeSeen()
    recordEvent('welcome_begin')
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  },

  openMethod() {
    recordEvent('welcome_method_open')
    this.setData({ showMethod: true })
  },

  closeMethod() { this.setData({ showMethod: false }) },

  openPrivacy() { navigateOnce(this, 'navigateTo', { url: '/pages/privacy/index' }) },

  handleMethodVisibleChange(event) { this.setData({ showMethod: Boolean(event.detail && event.detail.visible) }) }
})
