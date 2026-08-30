const { FEATURES } = require('../../utils/features')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildEvidenceView, PRODUCT_COPY, PRODUCT_V0_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    finding: null,
    personaId: ''
  },

  onLoad(options = {}) {
    if (options.mode === 'product-v0') {
      if (!FEATURES.v3ProductV0) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      this.mode = 'product-v0'
      this.dimensionId = options.dimension || ''
      this.setData({ copy: PRODUCT_V0_COPY })
      const session = productStore.getSession()
      const report = buildReport(session.derivedProfile || productRuntime.deriveProfile(session))
      this.setData({ ready: true, copy: PRODUCT_V0_COPY, personaId: '', finding: buildEvidenceView(report, this.dimensionId) })
      return
    }
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.dimensionId = options.dimension || ''
    const report = buildReport(getFixture(this.personaId))
    this.setData({ ready: true, personaId: this.personaId, finding: buildEvidenceView(report, this.dimensionId) })
  },

  onShow() { resetNavigation(this) },

  back() {
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: '/pages/v3-result/index?mode=product-v0' }) })
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}` }) })
  }
})
