const { FEATURES } = require('../../utils/features')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildEvidenceView, PRODUCT_COPY, PRODUCT_V0_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')
const { recordEvent } = require('../../utils/storage')

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    finding: null,
    personaId: '',
    returnTo: ''
  },

  onLoad(options = {}) {
    if (options.mode === 'product-v0') {
      if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      this.mode = 'product-v0'
      this.dimensionId = options.dimension || ''
      try { this.returnTo = options.returnTo ? decodeURIComponent(String(options.returnTo)) : '/pages/v3-result/index?mode=product-v0' } catch (error) { this.returnTo = '/pages/v3-result/index?mode=product-v0' }
      this.setData({ copy: PRODUCT_V0_COPY })
      const session = productStore.getSession()
      const report = buildReport(session.derivedProfile || productRuntime.deriveProfile(session))
      this.setData({ ready: true, copy: PRODUCT_V0_COPY, personaId: '', finding: buildEvidenceView(report, this.dimensionId), returnTo: this.returnTo })
      return
    }
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.dimensionId = options.dimension || ''
    this.returnTo = `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}`
    const report = buildReport(getFixture(this.personaId))
    this.setData({ ready: true, personaId: this.personaId, finding: buildEvidenceView(report, this.dimensionId), returnTo: this.returnTo })
  },

  onShow() { resetNavigation(this) },

  editEvidence(event) {
    const taskId = event.currentTarget.dataset.taskId
    if (!taskId) return
    recordEvent('answer_edit_open', { taskId, source: 'evidence' })
    navigateOnce(this, 'navigateTo', { url: `/pages/questionnaire-v3/index?taskId=${encodeURIComponent(taskId)}&returnTo=${encodeURIComponent(this.returnTo || '/pages/v3-result/index?mode=product-v0')}` })
  },

  back() {
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: this.returnTo || (this.mode === 'product-v0' ? '/pages/v3-result/index?mode=product-v0' : `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}`) }) })
  }
})
