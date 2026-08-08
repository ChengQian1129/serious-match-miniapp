const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const followupStore = require('../../utils/followup-store')
const followupCopy = require('../../shared/content/followup-copy')
const { recordEvent } = require('../../utils/storage')

Page({
  data: { hasRegistration: false, copy: followupCopy.intro },
  onShow() { resetNavigation(this); this.setData({ hasRegistration: Boolean(followupStore.get().participant.displayName) }); recordEvent('followup_intro_view') },
  defer() { navigateOnce(this, 'navigateBack', {}) },
  continue() { recordEvent('followup_continue'); navigateOnce(this, 'navigateTo', { url: '/pages/followup-settings/index' }) }
})
