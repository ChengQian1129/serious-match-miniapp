const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const followupStore = require('../../utils/followup-store')
const followupCopy = require('../../shared/content/followup-copy')
const { recordEvent } = require('../../utils/storage')

Page({
  data: { hasRegistration: false, copy: followupCopy.intro },
  onLoad(query) {
    this.returnTo = query && query.returnTo === 'map' ? 'map' : 'report'
  },
  onShow() { resetNavigation(this); this.setData({ hasRegistration: Boolean(followupStore.get().participant.displayName) }); recordEvent('followup_intro_view') },
  defer() {
    const fallback = this.returnTo === 'map' ? '/pages/relationship-map/index' : '/pages/questionnaire-result/index'
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: fallback }) })
  },
  continue() {
    recordEvent('followup_continue')
    const url = this.returnTo === 'map' || this.returnTo === 'report' ? `/pages/followup-settings/index?returnTo=${this.returnTo}` : '/pages/followup-settings/index'
    navigateOnce(this, 'redirectTo', { url })
  }
})
