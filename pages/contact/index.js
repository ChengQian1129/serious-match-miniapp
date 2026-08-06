const { getProfile, completeProfile, markCloudSynced, recordEvent } = require('../../utils/storage')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { config: cloudConfig, isCloudReady, saveProfileToCloud, cloudErrorMessage } = require('../../utils/cloud')

Page({
  data: {
    phone: '',
    confirmations: [],
    eligibilityChecked: false,
    privacyChecked: false,
    phoneError: '',
    consentError: '',
    cloudError: '',
    isValid: false,
    isSaving: false,
    isEditing: false,
    phoneFocused: false,
    keyboardVisible: false,
    confirmationOptions: [
      {
        value: 'eligibility',
        label: '我确认已满 18 周岁、在大连生活、单身，并自愿保存以上资料。'
      },
      {
        value: 'privacy',
        label: '我同意将资料提交到私密云端资源池，并已阅读隐私说明。'
      }
    ]
  },

  onLoad(query) {
    const profile = getProfile()
    const phone = profile.contact && profile.contact.phone ? profile.contact.phone : ''
    const hasSavedProfile = profile.status === 'active' || profile.status === 'paused'
    const hasCloudConsent = profile.consent && profile.consent.version === cloudConfig.privacyVersion
    const confirmations = hasSavedProfile
      ? ['eligibility'].concat(hasCloudConsent ? ['privacy'] : [])
      : []
    this.setData({
      phone,
      confirmations,
      eligibilityChecked: confirmations.includes('eligibility'),
      privacyChecked: confirmations.includes('privacy'),
      isEditing: query.edit === '1',
      cloudReady: isCloudReady(),
      isValid: this.validate(phone, confirmations)
    })
    recordEvent('contact_page_view')
  },

  onShow() {
    resetNavigation(this)
  },

  inputPhone(event) {
    const phone = event.detail.value.replace(/\D/g, '').slice(0, 11)
    const phoneValid = /^1[3-9]\d{9}$/.test(phone)
    this.setData({
      phone,
      phoneError: phone.length === 11 && !phoneValid ? '请填写正确的 11 位手机号' : '',
      isValid: this.validate(phone, this.data.confirmations)
    })
  },

  handlePhoneFocus() {
    this.setData({
      phoneFocused: true,
      keyboardVisible: true
    })
  },

  handlePhoneBlur() {
    const phoneValid = /^1[3-9]\d{9}$/.test(this.data.phone)
    this.setData({
      phoneFocused: false,
      keyboardVisible: false,
      phoneError: this.data.phone && !phoneValid ? '请填写正确的 11 位手机号' : ''
    })
  },

  handleKeyboardHeightChange(event) {
    const height = Number(event.detail && event.detail.height)
    this.setData({ keyboardVisible: Number.isFinite(height) && height > 0 })
  },

  handlePhoneConfirm() {
    this.setData({
      phoneFocused: false,
      keyboardVisible: false
    })
    wx.hideKeyboard()
  },

  clearPhone() {
    this.setData({
      phone: '',
      phoneError: '',
      isValid: false
    })
  },

  handleSaveNavigationFail() {
    this.setData({ isSaving: false })
    wx.showToast({
      title: '资料已保存，请再试一次',
      icon: 'none'
    })
  },

  changeConfirmations(event) {
    const confirmations = event.detail.value
    this.setData({
      confirmations,
      eligibilityChecked: confirmations.includes('eligibility'),
      privacyChecked: confirmations.includes('privacy'),
      consentError: '',
      cloudError: '',
      isValid: this.validate(this.data.phone, confirmations)
    })
  },

  toggleConfirmation(event) {
    const value = event.currentTarget.dataset.value
    const confirmations = this.data.confirmations.includes(value)
      ? this.data.confirmations.filter(item => item !== value)
      : this.data.confirmations.concat(value)
    this.changeConfirmations({ detail: { value: confirmations } })
  },

  validate(phone, confirmations) {
    return /^1[3-9]\d{9}$/.test(phone) && confirmations.includes('eligibility') && confirmations.includes('privacy')
  },

  openPrivacy() {
    navigateOnce(this, 'navigateTo', { url: '/pages/privacy/index' })
  },

  finishSave(profile) {
    markCloudSynced(profile)
    recordEvent('contact_submit')
    if (!this.data.isEditing) recordEvent('profile_created')

    const url = this.data.isEditing ? '/pages/profile/index' : '/pages/success/index'
    wx.reLaunch({
      url,
      fail: () => this.handleSaveNavigationFail()
    })
  },

  handleCloudSaveFail(error) {
    const message = cloudErrorMessage(error)
    this.setData({
      isSaving: false,
      cloudError: `${message}，资料已保留在本机`
    })
    wx.showToast({ title: message, icon: 'none' })
  },

  handleSave() {
    const phoneValid = /^1[3-9]\d{9}$/.test(this.data.phone)
    const consentValid = this.data.confirmations.includes('eligibility') && this.data.confirmations.includes('privacy')
    this.setData({
      phoneError: phoneValid ? '' : '请填写正确的 11 位手机号',
      consentError: consentValid ? '' : '请确认以上两项内容'
    })
    if (!phoneValid || !consentValid || this.data.isSaving) return

    this.setData({ isSaving: true, cloudError: '' })
    const profile = completeProfile(
      { type: 'phone', phone: this.data.phone, verified: false },
      {
        version: cloudConfig.privacyVersion,
        scope: 'cloud_resource_pool',
        operatorName: cloudConfig.operatorName,
        agreedAt: Date.now()
      }
    )
    saveProfileToCloud(profile, {
      success: () => this.finishSave(profile),
      fail: error => this.handleCloudSaveFail(error)
    })
  }
})
