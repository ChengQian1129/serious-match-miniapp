const { FEATURES } = require('../../utils/features')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildEvidenceView, PRODUCT_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

Page({
  data: {
    ready: false,
    copy: PRODUCT_COPY,
    finding: null,
    personaId: ''
  },

  onLoad(options = {}) {
    if (!FEATURES.v3ProductPreview) return navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
    this.personaId = getFixture(options.persona).persona.id
    this.dimensionId = options.dimension || ''
    const report = buildReport(getFixture(this.personaId))
    this.setData({ ready: true, personaId: this.personaId, finding: buildEvidenceView(report, this.dimensionId) })
  },

  onShow() { resetNavigation(this) },

  back() {
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}` }) })
  }
})
