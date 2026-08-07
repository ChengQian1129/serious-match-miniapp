const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const followupStore = require('../../utils/followup-store')

Page({
  data: { hasRegistration: false },
  onShow() { resetNavigation(this); this.setData({ hasRegistration: Boolean(followupStore.get().participant.displayName) }) },
  defer() { navigateOnce(this, 'navigateBack', {}) },
  continue() { navigateOnce(this, 'navigateTo', { url: '/pages/followup-settings/index' }) }
})
