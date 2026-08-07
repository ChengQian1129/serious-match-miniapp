const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { isCloudReady, getParticipant } = require('../../utils/cloud')
const store = require('../../utils/followup-store')

Page({
  data: { form: {}, contact: {}, participationTypes: [{ value: 'interview', label: '深度访谈' }, { value: 'research', label: '问卷理解研究' }, { value: 'offline', label: '线下交流活动' }], selectedTypes: [], isSaving: false, error: '' },
  onShow() { resetNavigation(this); this.load() },
  load() {
    const local = store.get()
    this.setParticipantData(local.participant || {}, local.contact || {})
    if (isCloudReady()) getParticipant({ success: data => { if (data.participant && !store.get().participant.displayName) { store.saveParticipant(data.participant, data.contact || {}); this.setParticipantData(data.participant, data.contact || {}) } }, fail: () => {} })
  },
  setParticipantData(participant, contact) {
    const selectedTypes = participant.participationTypes || []
    this.setData({ form: participant, contact, selectedTypes, participationTypes: this.data.participationTypes.map(item => Object.assign({}, item, { selected: selectedTypes.includes(item.value) })) })
  },
  input(event) { const field = event.currentTarget.dataset.field; this.setData({ [`form.${field}`]: String(event.detail.value || '') }) },
  inputContact(event) { const field = event.currentTarget.dataset.field; this.setData({ [`contact.${field}`]: String(event.detail.value || '') }) },
  toggleType(event) {
    const value = event.currentTarget.dataset.value
    const selected = this.data.selectedTypes.includes(value) ? this.data.selectedTypes.filter(item => item !== value) : this.data.selectedTypes.concat(value)
    this.setData({ selectedTypes: selected, participationTypes: this.data.participationTypes.map(item => Object.assign({}, item, { selected: selected.includes(item.value) })) })
  },
  save() {
    if (this.data.isSaving) return
    const participant = Object.assign({}, this.data.form, { participationTypes: this.data.selectedTypes })
    if (!participant.displayName || !participant.cityArea || !this.data.contact.value || !this.data.contact.channel || !this.data.contact.preferredTime || !this.data.selectedTypes.length) return this.setData({ error: '请先填写必填信息，并至少选择一种参与方式' })
    store.saveParticipant(participant, this.data.contact)
    navigateOnce(this, 'redirectTo', { url: '/pages/followup-settings/index' })
  },
  back() { navigateOnce(this, 'navigateBack', {}) }
})
