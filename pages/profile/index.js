const { getProfile, hasProfile, setStatus, deleteProfile, markCloudSynced, needsCloudSync } = require('../../utils/storage')
const { buildProfileView, maskPhone } = require('../../utils/formatters')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { config: cloudConfig, isCloudReady, saveProfileToCloud, setCloudStatus, deleteCloudProfile, cloudErrorMessage } = require('../../utils/cloud')

Page({
  data: {
    profile: {},
    profileView: {},
    displayName: '',
    maskedPhone: '',
    statusLabel: '',
    isPaused: false,
    isUpdatingStatus: false,
    isDeleting: false,
    showMenu: false,
    showDeleteDialog: false,
    deleteConfirmButton: { content: '删除', theme: 'danger', variant: 'base' }
  },

  onShow() {
    resetNavigation(this)
    if (!hasProfile()) {
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      return
    }
    this.refresh()
    this.syncProfileIfNeeded()
  },

  refresh() {
    const profile = getProfile()
    const isPaused = profile.status === 'paused'
    this.setData({
      profile,
      profileView: buildProfileView(profile),
      displayName: (profile.about || {}).displayName || '我的资料',
      maskedPhone: maskPhone((profile.contact || {}).phone),
      statusLabel: isPaused ? '已暂停' : '已保存',
      isPaused
    })
  },

  syncProfileIfNeeded() {
    const profile = getProfile()
    const hasCloudConsent = profile.consent && profile.consent.version === cloudConfig.privacyVersion
    if (!hasCloudConsent || !isCloudReady() || !needsCloudSync(profile)) return
    this._profileSyncing = true
    saveProfileToCloud(profile, {
      success: data => {
        this._profileSyncing = false
        markCloudSynced(profile, data.syncedAt)
      },
      fail: () => {
        this._profileSyncing = false
      }
    })
  },

  toggleMenu() {
    this.setData({ showMenu: !this.data.showMenu })
  },

  closeMenu() {
    this.setData({ showMenu: false })
  },

  handleMenuVisibleChange(event) {
    this.setData({ showMenu: event.detail.visible })
  },

  editBasic() {
    this.closeMenu()
    navigateOnce(this, 'navigateTo', { url: '/pages/onboarding-basic/index?edit=1' })
  },

  editRelationship() {
    this.closeMenu()
    navigateOnce(this, 'navigateTo', { url: '/pages/onboarding-relationship/index?edit=1' })
  },

  editAbout() {
    this.closeMenu()
    navigateOnce(this, 'navigateTo', { url: '/pages/onboarding-about/index?edit=1' })
  },

  editContact() {
    this.closeMenu()
    navigateOnce(this, 'navigateTo', { url: '/pages/contact/index?edit=1' })
  },

  viewRelationshipMap() {
    this.closeMenu()
    navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
  },

  togglePause(event) {
    const eventTime = event && Number(event.timeStamp)
    const now = Number.isFinite(eventTime) ? eventTime : Date.now()
    if (this._profileSyncing) {
      wx.showToast({ title: '资料同步中，请稍候', icon: 'none' })
      return
    }
    if (this.data.isUpdatingStatus || Number.isFinite(this._lastStatusTapAt) && now - this._lastStatusTapAt < 500) return
    this._lastStatusTapAt = now
    const nextStatus = this.data.isPaused ? 'active' : 'paused'
    this.closeMenu()
    this.setData({ isUpdatingStatus: true })
    setCloudStatus(nextStatus, Date.now(), {
      success: () => {
        const profile = setStatus(nextStatus)
        markCloudSynced(profile)
        this.setData({ isUpdatingStatus: false })
        this.refresh()
        wx.showToast({ title: nextStatus === 'paused' ? '已暂停参与' : '已恢复参与', icon: 'none' })
      },
      fail: error => {
        this.setData({ isUpdatingStatus: false })
        wx.showToast({ title: cloudErrorMessage(error), icon: 'none' })
      }
    })
  },

  openPrivacy() {
    this.closeMenu()
    navigateOnce(this, 'navigateTo', { url: '/pages/privacy/index' })
  },

  requestDelete() {
    if (this._profileSyncing) {
      this.closeMenu()
      wx.showToast({ title: '资料同步中，请稍候', icon: 'none' })
      return
    }
    this.closeMenu()
    this.setData({ showDeleteDialog: true })
  },

  cancelDelete() {
    this.setData({ showDeleteDialog: false })
  },

  confirmDelete() {
    if (this._profileSyncing) {
      this.setData({ showDeleteDialog: false })
      wx.showToast({ title: '资料同步中，请稍候', icon: 'none' })
      return
    }
    if (this.data.isDeleting) return
    this.setData({ showDeleteDialog: false, isDeleting: true })
    deleteCloudProfile({
      success: () => {
        deleteProfile()
        navigateOnce(this, 'reLaunch', {
          url: '/pages/home/index',
          fail: () => this.setData({ isDeleting: false })
        })
      },
      fail: error => {
        this.setData({ isDeleting: false })
        wx.showToast({ title: `${cloudErrorMessage(error)}，资料未删除`, icon: 'none' })
      }
    })
  }
})
