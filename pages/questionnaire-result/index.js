const { getModule } = require('../../utils/questionnaire-definitions')
const { latestAnswers } = require('../../utils/questionnaire-record')
const { getQuestionnaireData, recordEvent } = require('../../utils/storage')
const { saveQuestionnaireModuleToCloud } = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

const DEFAULT_MODULE_ID = 'current_relationship_readiness'

const fallbackCopy = {
  insufficient: '这一部分还没有足够的有效回答，暂时保留未知。',
  unclear: '目前的回答没有形成一致方向，适合结合具体情境继续了解。'
}

function reportSections(module, moduleRecord) {
  const evaluation = moduleRecord.evaluation || { observations: [], claims: [] }
  const dimensionSections = module.dimensions.filter(dimension => dimension.scoringRole !== 'observation').map(dimension => {
    const observation = evaluation.observations.find(item => item.constructId === dimension.id)
    const claim = evaluation.claims.find(item => item.subjectArea === dimension.id)
    const confidenceState = claim ? claim.confidenceState : 'insufficient_evidence'
    const statusLabels = {
      multi_item_supported: '多题支持',
      initial: '初步判断',
      direct_fact: '本人选择',
      insufficient_evidence: '依据不足'
    }
    return {
      id: dimension.id,
      title: dimension.title,
      text: claim ? claim.userFacingText : fallbackCopy[observation && observation.direction] || fallbackCopy.unclear,
      evidenceText: observation && observation.validCount !== undefined
        ? `${observation.validCount} / ${observation.requiredCount} 项有效依据`
        : claim ? `${claim.evidenceCount} 项有效依据` : '暂无有效依据',
      confidenceState,
      statusLabel: statusLabels[confidenceState] || '初步判断'
    }
  })

  const observationDimensionIds = new Set(module.dimensions
    .filter(dimension => dimension.scoringRole === 'observation')
    .map(dimension => dimension.id))
  const behaviorSections = evaluation.claims
    .filter(claim => observationDimensionIds.has(claim.subjectArea))
    .map((claim, index) => ({
      id: claim.claimId,
      title: `常见应对动作 ${index + 1}`,
      text: claim.userFacingText,
      evidenceText: `${claim.evidenceCount} 项有效依据`,
      confidenceState: claim.confidenceState,
      statusLabel: '本人选择'
    }))

  return dimensionSections.concat(behaviorSections)
}

Page({
  data: {
    isReady: false,
    moduleTitle: '',
    moduleItemCount: 0,
    sections: [],
    answeredCount: 0,
    skippedCount: 0
  },

  onLoad(query) {
    this.moduleId = query.module || DEFAULT_MODULE_ID
    const module = getModule(this.moduleId)
    const moduleRecord = getQuestionnaireData().modules[this.moduleId]
    if (!module || !moduleRecord || moduleRecord.status !== 'complete') return
    const answers = latestAnswers(moduleRecord)
    const values = Object.values(answers)
    this.moduleRecord = moduleRecord
    this.setData({
      isReady: true,
      moduleTitle: module.title,
      moduleItemCount: module.items.length,
      sections: reportSections(module, moduleRecord),
      answeredCount: values.filter(value => value !== 'SKIP' && value !== 'NA').length,
      skippedCount: values.filter(value => value === 'SKIP' || value === 'NA').length
    })
    this.syncModule()
  },

  onShow() {
    resetNavigation(this)
    if (this.data.isReady) recordEvent('questionnaire_result_view', { moduleId: this.moduleId })
  },

  syncModule() {
    saveQuestionnaireModuleToCloud(this.moduleRecord, {
      success: () => recordEvent('questionnaire_result_cloud_sync_succeeded', { moduleId: this.moduleId }),
      fail: () => recordEvent('questionnaire_result_cloud_sync_failed', { moduleId: this.moduleId })
    })
  },

  revise() {
    navigateOnce(this, 'redirectTo', { url: `/pages/questionnaire/index?module=${this.moduleId}&revise=1&question=0&direction=back` })
  },

  openMap() {
    navigateOnce(this, 'reLaunch', { url: '/pages/relationship-map/index' })
  }
})
