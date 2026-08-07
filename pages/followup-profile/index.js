const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { isCloudReady, getParticipant } = require('../../utils/cloud')
const store = require('../../utils/followup-store')

Page({
  data: { form: {}, contact: {}, isSaving: false, error: '' },
  onShow() { resetNavigation(this); this.load() },
  load() {
    const local = store.get()
    this.setParticipantData(local.participant || {}, local.contact || {})
    if (isCloudReady()) getParticipant({ success: data => { if (data.participant && !store.get().participant.displayName) { store.markParticipantSynced(data.participant, data.contact || {}); this.setParticipantData(data.participant, data.contact || {}) } }, fail: () => {} })
  },
  setParticipantData(participant, contact) {
    const form = Object.assign({}, participant)
    if (!form.availability && contact.preferredTime) form.availability = contact.preferredTime
    this.setData({ form, contact })
  },
  input(event) { const field = event.currentTarget.dataset.field; this.setData({ [`form.${field}`]: String(event.detail.value || '') }) },
  inputContact(event) { const field = event.currentTarget.dataset.field; this.setData({ [`contact.${field}`]: String(event.detail.value || '') }) },
  save() {
    if (this.data.isSaving) return
    const state = store.get()
    const participationTypes = store.participationTypesFromConsents(state.consents)
    const participant = Object.assign({}, this.data.form, { participationTypes })
    const contact = Object.assign({}, this.data.contact, { preferredTime: participant.availability })
    if (!store.requiresContact(state.consents)) return this.setData({ error: '请先在授权页面选择需要联系的参与方式' })
    if (!participant.displayName || !participant.cityArea || !participant.availability || !contact.value || !contact.channel) return this.setData({ error: '请先填写称呼、区域、方便参与的时间和联系方式' })
    store.saveParticipant(participant, contact)
    navigateOnce(this, 'redirectTo', { url: '/pages/followup-settings/index' })
  },
  back() { navigateOnce(this, 'navigateBack', {}) }
})
