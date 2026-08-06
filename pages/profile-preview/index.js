const { getProfile, recordEvent } = require('../../utils/storage')
const { buildProfileView } = require('../../utils/formatters')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  data: {
    profileView: {},
    isEditing: false
  },

  onLoad(query) {
    const profile = getProfile()
    this.setData({
      profileView: buildProfileView(profile),
      isEditing: query.edit === '1'
    })
    recordEvent('preview_view')
  },

  onShow() {
    resetNavigation(this)
  },

  handleConfirm() {
    if (this.data.isEditing) {
      navigateOnce(this, 'reLaunch', { url: '/pages/profile/index' })
      return
    }
    navigateOnce(this, 'navigateTo', { url: '/pages/contact/index' })
  },

  handleBack() {
    navigateOnce(this, 'navigateBack')
  }
})
