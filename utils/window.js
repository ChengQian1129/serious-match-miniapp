function getStatusBarHeight() {
  if (typeof wx !== 'undefined' && typeof wx.getWindowInfo === 'function') {
    const windowInfo = wx.getWindowInfo()
    return windowInfo.statusBarHeight || 0
  }

  if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
    return wx.getSystemInfoSync().statusBarHeight || 0
  }

  return 0
}

module.exports = {
  getStatusBarHeight
}
