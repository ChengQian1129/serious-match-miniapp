const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { isCloudReady, grantFollowupConsent, revokeFollowupConsent, getParticipant, saveParticipant, deleteParticipant, cloudErrorMessage } = require('../../utils/cloud')
const store = require('../../utils/followup-store')
const followupCopy = require('../../shared/content/followup-copy')
const { recordEvent } = require('../../utils/storage')

const DEFINITIONS = [
  { scope: 'interview_contact', title: followupCopy.scopes.interview_contact.title, desc: followupCopy.scopes.interview_contact.description },
  { scope: 'research_use', title: followupCopy.scopes.research_use.title, desc: followupCopy.scopes.research_use.description },
  { scope: 'offline_invitation', title: followupCopy.scopes.offline_invitation.title, desc: followupCopy.scopes.offline_invitation.description }
]

Page({
  data: { scopes: DEFINITIONS, copy: followupCopy.settings, isSaving: false, isDeleting: false, error: '', hasProfile: false, requiresContact: false },
  onShow() { resetNavigation(this); this.load(); recordEvent('followup_entry_view') },
  load() {
    const local = store.get()
    this.apply(local.consents || {}, local.participant)
    if (isCloudReady()) getParticipant({ success: data => { let state = store.mergeCloudConsents(data.consents || {}); if (!state.participant.displayName && data.participant) { state.participant = data.participant; state.contact = data.contact || {}; state = store.save(state) } this.apply(state.consents || {}, state.participant) }, fail: () => {} })
  },
  apply(consents, participant) {
    const scopes = DEFINITIONS.map(item => Object.assign({}, item, { checked: Boolean(consents[item.scope] && consents[item.scope].value === 'granted'), grantedAt: consents[item.scope] && consents[item.scope].value === 'granted' ? consents[item.scope].createdAt : null }))
    this.setData({ scopes, hasProfile: Boolean(participant && participant.displayName), requiresContact: scopes.some(item => item.checked && ['interview_contact', 'offline_invitation'].includes(item.scope)) })
  },
  toggle(event) {
    const scope = event.currentTarget.dataset.scope
    const scopes = this.data.scopes.map(item => item.scope === scope ? Object.assign({}, item, { checked: !item.checked }) : item)
    this.setData({ scopes, requiresContact: scopes.some(item => item.checked && ['interview_contact', 'offline_invitation'].includes(item.scope)) })
    recordEvent('followup_scope_change', { scope, value: scopes.find(item => item.scope === scope).checked ? 'granted' : 'revoked' })
  },
  save() {
    if (this.data.isSaving) return
    this.setData({ isSaving: true, error: '' })
    const state = store.get()
    const previous = state.consents || {}
    const changed = this.data.scopes.filter(item => Boolean(previous[item.scope] && previous[item.scope].value === 'granted') !== item.checked || Boolean(previous[item.scope] && previous[item.scope].pendingCloud))
    const run = index => {
      if (index >= changed.length) return this.saveProfileIfAllowed()
      const item = changed[index]
      const pending = previous[item.scope] && previous[item.scope].pendingCloud && Boolean(previous[item.scope].value === 'granted') === item.checked ? previous[item.scope] : null
      const consentEvent = pending || store.appendConsent(item.scope, item.checked ? 'granted' : 'revoked')
      if (!isCloudReady()) return run(index + 1)
      const action = item.checked ? grantFollowupConsent : revokeFollowupConsent
      action(consentEvent, { success: data => { store.markConsentSynced(consentEvent.eventId, data.consentEvent); run(index + 1) }, fail: error => this.setData({ isSaving: false, error: cloudErrorMessage(error) }) })
    }
    run(0)
  },
  saveProfileIfAllowed() {
    const state = store.get()
    const contactGranted = store.requiresContact(state.consents)
      const finish = data => { if (data && data.participant) store.markParticipantSynced(data.participant, data.contact); this.setData({ isSaving: false }); wx.showToast({ title: '已保存', icon: 'success' }); this.load() }
    if (contactGranted && !(state.participant && state.participant.displayName)) {
      this.setData({ isSaving: false })
      return navigateOnce(this, 'redirectTo', { url: '/pages/followup-profile/index' })
    }
    if (contactGranted && state.participant && state.participant.displayName && state.participantWrite && state.participantWrite.pendingCloud && isCloudReady()) return saveParticipant(state.participant, state.contact, state.participantWrite, { success: finish, fail: error => this.setData({ isSaving: false, error: cloudErrorMessage(error) }) })
    finish()
  },
  editProfile() { navigateOnce(this, 'redirectTo', { url: '/pages/followup-profile/index' }) },
  deleteRegistration() {
    if (this.data.isDeleting) return
    wx.showModal({ title: followupCopy.settings.deleteTitle, content: followupCopy.settings.deleteBody, confirmText: followupCopy.settings.deleteConfirm, cancelText: followupCopy.settings.deleteCancel, confirmColor: '#ff3b30', success: result => {
      if (!result.confirm) return
      this.setData({ isDeleting: true, error: '' })
      const finish = () => { store.clear(); this.setData({ isDeleting: false }); navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' }) }
      if (isCloudReady()) deleteParticipant({ success: finish, fail: error => this.setData({ isDeleting: false, error: cloudErrorMessage(error) }) }); else finish()
    } })
  }
})
