const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { isCloudReady, getParticipant, saveParticipant, cloudErrorMessage } = require('../../utils/cloud')
const store = require('../../utils/followup-store')
const followupCopy = require('../../shared/content/followup-copy')
const { recordEvent } = require('../../utils/storage')

const CONTACT_CHANNELS = [
  { value: 'wechat', label: followupCopy.channels.wechat },
  { value: 'phone', label: followupCopy.channels.phone },
  { value: 'email', label: followupCopy.channels.email },
  { value: 'other', label: followupCopy.channels.other }
]

Page({
  data: { form: {}, contact: {}, copy: followupCopy.profile, contactChannels: CONTACT_CHANNELS, isSaving: false, error: '' },
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
  chooseContactChannel(event) {
    const contact = Object.assign({}, this.data.contact, { channel: event.currentTarget.dataset.value })
    this.setData({ contact, error: '' })
  },
  save() {
    if (this.data.isSaving) return
    const state = store.get()
    const participationTypes = store.participationTypesFromConsents(state.consents)
    const participant = Object.assign({}, this.data.form, { participationTypes })
    const contact = Object.assign({}, this.data.contact, { preferredTime: participant.availability })
    if (!store.requiresContact(state.consents)) return this.setData({ error: followupCopy.profile.consentError })
    if (!participant.displayName || !participant.cityArea || !participant.availability || !contact.value || !contact.channel) return this.setData({ error: followupCopy.profile.requiredError })
    const saved = store.saveParticipant(participant, contact)
    const finish = data => {
      if (data && data.participant) store.markParticipantSynced(data.participant, data.contact || contact)
      this.setData({ isSaving: false })
      recordEvent('followup_profile_save')
      navigateOnce(this, 'redirectTo', { url: '/pages/followup-settings/index' })
    }
    if (!isCloudReady()) return finish()
    this.setData({ isSaving: true, error: '' })
    saveParticipant(participant, contact, saved.participantWrite, {
      success: finish,
      fail: error => this.setData({ isSaving: false, error: cloudErrorMessage(error) })
    })
  },
  back() { navigateOnce(this, 'navigateBack', {}) }
})
