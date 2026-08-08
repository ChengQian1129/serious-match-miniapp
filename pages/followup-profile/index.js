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
const CONTACT_FIELDS = followupCopy.contactFields

function contactField(channel) { return CONTACT_FIELDS[channel] || null }

function normalizeText(value) { return String(value || '').trim() }

function normalizeContactValue(value, channel) {
  const normalized = normalizeText(value)
  return channel === 'phone' ? normalized.replace(/[\s()-]/g, '') : normalized
}

function contactError(contact) {
  const channel = contact && contact.channel
  const value = normalizeContactValue(contact && contact.value, channel)
  if (!contactField(channel)) return followupCopy.profile.channelRequiredError
  if (!value) return followupCopy.profile.contactRequiredError
  if (channel === 'phone' && !/^\+?\d{7,15}$/.test(value)) return followupCopy.profile.phoneError
  if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return followupCopy.profile.emailError
  if (channel === 'wechat' && /\s/.test(value)) return followupCopy.profile.wechatError
  return ''
}

Page({
  data: { form: {}, contact: {}, contactField: null, copy: followupCopy.profile, contactChannels: CONTACT_CHANNELS, isSaving: false, error: '' },
  onLoad(query) {
    this.returnTo = query && query.returnTo === 'settings' ? 'settings' : 'back'
    this.returnAfter = query && query.returnAfter === 'map' ? 'map' : 'report'
  },
  onShow() { resetNavigation(this); this.load() },
  load() {
    const local = store.get()
    this.setParticipantData(local.participant || {}, local.contact || {})
    if (isCloudReady()) getParticipant({ success: data => { if (data.participant && !store.get().participant.displayName) { store.markParticipantSynced(data.participant, data.contact || {}); this.setParticipantData(data.participant, data.contact || {}) } }, fail: () => {} })
  },
  setParticipantData(participant, contact) {
    const form = Object.assign({}, participant)
    if (!form.availability && contact.preferredTime) form.availability = contact.preferredTime
    this.setData({ form, contact, contactField: contactField(contact.channel) })
  },
  input(event) { const field = event.currentTarget.dataset.field; this.setData({ [`form.${field}`]: String(event.detail.value || '') }) },
  inputContact(event) { const field = event.currentTarget.dataset.field; this.setData({ [`contact.${field}`]: String(event.detail.value || '') }) },
  chooseContactChannel(event) {
    const channel = event.currentTarget.dataset.value
    if (!contactField(channel)) return
    const contact = Object.assign({}, this.data.contact, { channel })
    if (this.data.contact.channel !== channel) contact.value = ''
    this.setData({ contact, contactField: contactField(channel), error: '' })
  },
  save() {
    if (this.data.isSaving) return
    const state = store.get()
    const participationTypes = store.participationTypesFromConsents(state.consents)
    const participant = Object.assign({}, this.data.form, {
      displayName: normalizeText(this.data.form.displayName),
      cityArea: normalizeText(this.data.form.cityArea),
      availability: normalizeText(this.data.form.availability),
      note: normalizeText(this.data.form.note),
      participationTypes
    })
    const contact = Object.assign({}, this.data.contact, {
      channel: normalizeText(this.data.contact.channel),
      value: normalizeContactValue(this.data.contact.value, this.data.contact.channel),
      preferredTime: participant.availability
    })
    if (!store.requiresContact(state.consents)) return this.setData({ error: followupCopy.profile.consentError })
    if (!participant.displayName || !participant.cityArea || !participant.availability) return this.setData({ error: followupCopy.profile.participantRequiredError })
    const validationError = contactError(contact)
    if (validationError) return this.setData({ error: validationError })
    const saved = store.saveParticipant(participant, contact)
    const finish = data => {
      if (data && data.participant) store.markParticipantSynced(data.participant, data.contact || contact)
      this.setData({ isSaving: false, error: '' })
      recordEvent('followup_profile_save')
      const url = this.returnAfter === 'map' || this.returnAfter === 'report' ? `/pages/followup-settings/index?returnTo=${this.returnAfter}` : '/pages/followup-settings/index'
      navigateOnce(this, 'redirectTo', { url })
    }
    if (!isCloudReady()) return finish()
    this.setData({ isSaving: true, error: '' })
    saveParticipant(participant, contact, saved.participantWrite, {
      success: finish,
      fail: error => this.setData({ isSaving: false, error: cloudErrorMessage(error) })
    })
  },
  back() {
    if (this.returnTo === 'settings') return navigateOnce(this, 'redirectTo', { url: `/pages/followup-settings/index?returnTo=${this.returnAfter}` })
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: this.returnAfter === 'map' ? '/pages/relationship-map/index' : '/pages/questionnaire-result/index' }) })
  }
})
