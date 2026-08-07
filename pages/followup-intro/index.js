const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  onShow() { resetNavigation(this) },
  defer() { navigateOnce(this, 'navigateBack', {}) },
  continue() {
    wx.showToast({ title: '参与登记将在下一阶段开放', icon: 'none' })
  }
})
