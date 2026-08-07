const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { isCloudReady, grantFollowupConsent, revokeFollowupConsent, getParticipant, saveParticipant, deleteParticipant, cloudErrorMessage } = require('../../utils/cloud')
const store = require('../../utils/followup-store')

const DEFINITIONS = [
  { scope: 'interview_contact', title: '联系我了解后续访谈', desc: '允许运营人员按照你留下的方式联系。不开启也不影响报告。' },
  { scope: 'research_use', title: '用于改进问卷与报告模型', desc: '允许将去标识化后的回答和核对结果用于研究分析。' },
  { scope: 'offline_invitation', title: '邀请我了解线下活动', desc: '允许发送大连线下交流活动信息；每个活动仍会另行确认。' }
]

Page({
  data: { scopes: DEFINITIONS, isSaving: false, isDeleting: false, error: '', hasProfile: false, requiresContact: false },
  onShow() { resetNavigation(this); this.load() },
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
    wx.showModal({ title: '删除参与登记？', content: '将删除联系方式、参与资料、授权和关联访谈记录，不影响关系说明书。', confirmText: '删除', confirmColor: '#ff3b30', success: result => {
      if (!result.confirm) return
      this.setData({ isDeleting: true, error: '' })
      const finish = () => { store.clear(); this.setData({ isDeleting: false }); navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' }) }
      if (isCloudReady()) deleteParticipant({ success: finish, fail: error => this.setData({ isDeleting: false, error: cloudErrorMessage(error) }) }); else finish()
    } })
  }
})
