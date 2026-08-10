const { FEATURES } = require('../../utils/features')
const { listFixtures } = require('../../shared/assessment-v3-product/fixtures')
const { PRODUCT_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

function personaViews() {
  return listFixtures().map(fixture => ({
    id: fixture.persona.id,
    label: PRODUCT_COPY.personas[fixture.persona.labelKey].label,
    description: PRODUCT_COPY.personas[fixture.persona.descriptionKey].description
  }))
}

Page({
  data: {
    ready: false,
    personas: [],
    selectedPersonaId: '',
    selectedPersona: null,
    copy: PRODUCT_COPY
  },

  onLoad(options = {}) {
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    const personas = personaViews()
    const selectedPersonaId = personas.some(item => item.id === options.persona) ? options.persona : personas[0].id
    this.setData({ ready: true, personas, selectedPersonaId, selectedPersona: personas.find(item => item.id === selectedPersonaId) })
  },

  onShow() { resetNavigation(this) },

  choosePersona(event) {
    const selectedPersonaId = event.currentTarget.dataset.id
    const selectedPersona = this.data.personas.find(item => item.id === selectedPersonaId)
    if (!selectedPersona) return
    this.setData({ selectedPersonaId, selectedPersona })
  },

  startChapter() {
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-checkpoint/index?persona=${encodeURIComponent(this.data.selectedPersonaId)}&chapter=C1` })
  },

  openReport() {
    navigateOnce(this, 'navigateTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.data.selectedPersonaId)}` })
  }
})

module.exports = { personaViews }
