const { FEATURES } = require('../../utils/features')
const { getFixture } = require('../../shared/assessment-v3-product/fixtures')
const { buildReport, buildPartialReport, buildEvidenceView, PRODUCT_COPY, PRODUCT_V0_COPY } = require('../../shared/assessment-v3-product/report-renderer')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const productRuntime = require('../../shared/assessment-v3-product-v0/runtime-engine')
const productStore = require('../../utils/assessment-v3-product-v0/session-store')
const productJourney = require('../../utils/assessment-v3-product-v0/journey-model')
const { recordEvent } = require('../../utils/storage')
const { resolveReturnContext, questionnaireEditUrl, parentResultUrl } = require('../../utils/assessment-v3-product-v0/return-context')

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
      this.returnContext = resolveReturnContext(options, { source: 'result' })
      this.dimensionId = options.dimension || this.returnContext.targetId || ''
      this.setData({ copy: PRODUCT_V0_COPY })
      const session = productStore.getSession()
      const isComplete = Boolean(session.completedAt && productJourney.isAssessmentComplete(session))
      const profile = isComplete && session.derivedProfile ? session.derivedProfile : productRuntime.deriveProfile(session)
      const report = isComplete
        ? buildReport(profile)
        : buildPartialReport(profile, productJourney.getCompletedSections(session, PRODUCT_V0_COPY).map(section => section.id))
      this.returnTo = parentResultUrl(this.returnContext, !isComplete)
      this.setData({ ready: true, copy: PRODUCT_V0_COPY, personaId: '', finding: buildEvidenceView(report, this.dimensionId), returnTo: this.returnTo })
      this.restoreReturnAnchor()
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

  restoreReturnAnchor() {
    if (this._returnAnchorRestored || !this.returnContext || !this.returnContext.scrollAnchor) return
    if (typeof wx === 'undefined' || typeof wx.pageScrollTo !== 'function') return
    this._returnAnchorRestored = true
    const scroll = () => wx.pageScrollTo({ selector: `#${this.returnContext.scrollAnchor}`, offsetTop: -24, duration: 0 })
    if (typeof wx.nextTick === 'function') wx.nextTick(scroll)
    else scroll()
  },

  editEvidence(event) {
    const taskId = event.currentTarget.dataset.taskId
    const itemId = event.currentTarget.dataset.itemId || ''
    if (!taskId) return
    if (this.mode === 'product-v0' && !productJourney.canFinishEditing(productStore.getSession(), taskId)) {
      const message = (PRODUCT_V0_COPY.questionnaire && PRODUCT_V0_COPY.questionnaire.editUnavailable) || '这道题还没有回答'
      if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') wx.showToast({ title: message, icon: 'none' })
      recordEvent('questionnaire_edit_guard', { taskId, itemId, reason: 'not_answered' })
      return false
    }
    const reportVersion = Number((productStore.getReport() || {}).reportVersion) || 0
    const context = this.mode === 'product-v0'
      ? { source: 'evidence', targetId: this.dimensionId || '', scrollAnchor: `evidence-${taskId}-${itemId || 'task'}`, reportVersion }
      : null
    recordEvent('answer_edit_open', { taskId, itemId, source: 'evidence' })
    if (this.mode === 'product-v0') return navigateOnce(this, 'navigateTo', { url: questionnaireEditUrl(taskId, context) })
    navigateOnce(this, 'navigateTo', { url: `/pages/questionnaire-v3/index?taskId=${encodeURIComponent(taskId)}&mode=edit&returnContext=${encodeURIComponent(JSON.stringify({ source: 'result', targetId: '', scrollAnchor: '', reportVersion: 0 }))}` })
  },

  back() {
    navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'redirectTo', { url: this.returnTo || (this.mode === 'product-v0' ? '/pages/v3-result/index?mode=product-v0' : `/pages/v3-result/index?persona=${encodeURIComponent(this.personaId)}`) }) })
  }
})
