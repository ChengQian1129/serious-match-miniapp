const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const followupStore = require('../../utils/followup-store')
const followupCopy = require('../../shared/content/followup-copy')
const { recordEvent } = require('../../utils/storage')

Page({
  data: { hasRegistration: false, copy: followupCopy.intro },
  onLoad(query) {
    const target = query && query.returnTo
    this.returnTo = ['map', 'product-v0'].includes(target) ? target : 'report'
  },
  onShow() { resetNavigation(this); this.setData({ hasRegistration: Boolean(followupStore.get().participant.displayName) }); recordEvent('followup_intro_view') },
  defer() {
    const fallback = this.returnTo === 'map' ? '/pages/relationship-map/index' : this.returnTo === 'product-v0' ? '/pages/v3-result/index?mode=product-v0' : '/pages/questionnaire-result/index'
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: fallback }) })
  },
  continue() {
    recordEvent('followup_continue')
    const url = ['map', 'report', 'product-v0'].includes(this.returnTo) ? `/pages/followup-settings/index?returnTo=${this.returnTo}` : '/pages/followup-settings/index'
    navigateOnce(this, 'redirectTo', { url })
  }
})
