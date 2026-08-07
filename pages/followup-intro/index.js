const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const followupStore = require('../../utils/followup-store')

Page({
  data: { hasRegistration: false },
  onShow() { resetNavigation(this); this.setData({ hasRegistration: Boolean(followupStore.get().participant.displayName) }) },
  defer() { navigateOnce(this, 'navigateBack', {}) },
  continue() { navigateOnce(this, 'navigateTo', { url: this.data.hasRegistration ? '/pages/followup-settings/index' : '/pages/followup-profile/index' }) }
})
