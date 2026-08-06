const {
  getProfile,
  hasProfile,
  getExploration,
  hasExploration,
  getRelationshipRecord,
  getQuestionnaireProgress,
  recordEvent
} = require('../../utils/storage')
const { draftProfileRoute } = require('../../utils/profile-route')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

function progressText(progress) {
  if (progress.complete) return '已完成'
  return progress.answered ? `${progress.answered} / ${progress.total}` : '尚未开始'
}

Page({
  data: {
    facts: [],
    claims: [],
    openQuestions: [],
    summary: '',
    recommendation: {},
    profileStatusText: '尚未建立',
    explorationStatusText: '尚未开始',
    questionnaireStatusText: '尚未开始',
    interactionStatusText: '尚未开始',
    needsStatusText: '尚未开始',
    showProfileSettings: false
  },

  onShow() {
    resetNavigation(this)
    this.refresh()
    recordEvent('relationship_map_view')
  },

  refresh() {
    const record = getRelationshipRecord()
    const profileExists = hasProfile()
    const profile = getProfile()
    const explorationExists = hasExploration()
    const exploration = getExploration()
    const profileComplete = profileExists && ['active', 'paused'].includes(profile.status)
    const questionnaireProgress = getQuestionnaireProgress('current_relationship_readiness')
    const interactionProgress = getQuestionnaireProgress('intimate_interaction_style')
    const needsProgress = getQuestionnaireProgress('needs_and_provision')
    const unreviewedClaim = record.claims.find(item => item.feedback === 'unreviewed')

    let recommendation
    if (!profileComplete) {
      recommendation = {
        kicker: '下一步最值得补充的',
        title: profileExists ? '继续完成个人档案' : '建立最基本的个人档案',
        desc: '先补充本人明确填写的事实，让后续判断有现实背景。',
        action: profileExists ? '从上次的位置继续' : '开始填写个人档案',
        type: 'profile'
      }
    } else if (!explorationExists || exploration.status === 'draft') {
      recommendation = {
        kicker: '下一步最值得了解的',
        title: '先从五个相处选择开始',
        desc: '用大约 1 分钟，形成第一组可以继续核对的初步判断。',
        action: '开始初步探索',
        type: 'exploration'
      }
    } else if (exploration.status === 'complete') {
      recommendation = {
        kicker: '下一步最值得做的',
        title: '先确认是否保存这份初步结果',
        desc: '保存前回答只留在当前设备，由你决定是否写入关系档案。',
        action: '查看初步结果',
        type: 'exploration-result'
      }
    } else if (!questionnaireProgress.complete) {
      recommendation = {
        kicker: '下一步正式了解的',
        title: '我现在适合开始一段关系吗',
        desc: questionnaireProgress.answered
          ? `已到 ${questionnaireProgress.answered} / ${questionnaireProgress.total}，从上次的位置继续。`
          : '分别了解真实意愿、现实余力、早期不确定和外部压力，不形成总分。',
        action: questionnaireProgress.answered ? '继续回答' : '开始这一部分',
        type: 'questionnaire',
        moduleId: 'current_relationship_readiness'
      }
    } else if (!interactionProgress.complete) {
      recommendation = {
        kicker: '下一步继续了解的',
        title: '我怎样靠近一个人',
        desc: interactionProgress.answered
          ? `已到 ${interactionProgress.answered} / ${interactionProgress.total}，从上次的位置继续。`
          : '观察关系不明确和逐渐亲近时的真实反应，不归类为任何依恋类型。',
        action: interactionProgress.answered ? '继续回答' : '开始这一部分',
        type: 'questionnaire',
        moduleId: 'intimate_interaction_style'
      }
    } else if (!needsProgress.complete) {
      recommendation = {
        kicker: '下一步继续了解的',
        title: '我需要怎样的相处，也能提供什么',
        desc: needsProgress.answered
          ? `已到 ${needsProgress.answered} / ${needsProgress.total}，从上次的位置继续。`
          : '把自己的需要和能够稳定提供的行为分开记录，不计算匹配分数。',
        action: needsProgress.answered ? '继续回答' : '开始这一部分',
        type: 'questionnaire',
        moduleId: 'needs_and_provision'
      }
    } else if (unreviewedClaim) {
      recommendation = {
        kicker: '下一步最值得核对的',
        title: unreviewedClaim.title,
        desc: '告诉我们这段描述是否接近你的真实感受，档案会保留你的反馈。',
        action: '核对这条判断',
        type: 'claim',
        claimId: unreviewedClaim.id
      }
    } else {
      recommendation = {
        kicker: '当前可以继续维护的',
        title: '回看你的个人档案',
        desc: '关系计划和现实情况会变化，可以随时回来更新。',
        action: '查看个人档案',
        type: 'profile'
      }
    }

    this.setData({
      facts: record.facts,
      claims: record.claims,
      openQuestions: record.openQuestions,
      summary: `${record.facts.length} 项本人陈述 · ${record.claims.length} 条可核对描述`,
      recommendation,
      profileStatusText: profileComplete ? (profile.status === 'paused' ? '已暂停' : '已建立') : profileExists ? '填写中' : '尚未建立',
      explorationStatusText: explorationExists && exploration.status === 'saved'
        ? '已保存'
        : explorationExists && exploration.status === 'complete' ? '待保存' : explorationExists ? '进行中' : '尚未开始',
      questionnaireStatusText: progressText(questionnaireProgress),
      interactionStatusText: progressText(interactionProgress),
      needsStatusText: progressText(needsProgress),
      showProfileSettings: profileComplete
    })
  },

  openNext() {
    const recommendation = this.data.recommendation
    if (recommendation.type === 'claim') {
      this.openClaimById(recommendation.claimId)
      return
    }
    if (recommendation.type === 'profile') {
      this.openProfile()
      return
    }
    if (recommendation.type === 'questionnaire') {
      this.openQuestionnaire(recommendation.moduleId)
      return
    }
    if (recommendation.type === 'exploration-result') {
      navigateOnce(this, 'navigateTo', { url: '/pages/exploration-result/index' })
      return
    }
    this.openExploration()
  },

  openClaim(event) {
    this.openClaimById(event.currentTarget.dataset.id)
  },

  openClaimById(claimId) {
    if (!claimId) return
    navigateOnce(this, 'navigateTo', { url: `/pages/record-claim/index?id=${encodeURIComponent(claimId)}` })
  },

  openExploration() {
    const exploration = getExploration()
    if (hasExploration() && ['complete', 'saved'].includes(exploration.status)) {
      navigateOnce(this, 'navigateTo', { url: '/pages/exploration-result/index' })
      return
    }
    const question = Number.isInteger(exploration.currentQuestion) ? exploration.currentQuestion : 0
    navigateOnce(this, 'navigateTo', { url: `/pages/exploration/index?question=${question}` })
  },

  openQuestionnaire(eventOrModuleId) {
    const moduleId = typeof eventOrModuleId === 'string'
      ? eventOrModuleId
      : eventOrModuleId && eventOrModuleId.currentTarget && eventOrModuleId.currentTarget.dataset.module
        || 'current_relationship_readiness'
    const progress = getQuestionnaireProgress(moduleId)
    const url = progress.complete
      ? `/pages/questionnaire-result/index?module=${moduleId}`
      : `/pages/questionnaire/index?module=${moduleId}`
    navigateOnce(this, 'navigateTo', { url })
  },

  openProfile() {
    if (!hasProfile()) {
      navigateOnce(this, 'navigateTo', { url: '/pages/onboarding-basic/index?direction=forward' })
      return
    }
    const profile = getProfile()
    if (['active', 'paused'].includes(profile.status)) {
      navigateOnce(this, 'navigateTo', { url: '/pages/profile/index' })
      return
    }
    navigateOnce(this, 'navigateTo', { url: draftProfileRoute(profile) })
  },

  openDataSettings() {
    if (!this.data.showProfileSettings) return
    navigateOnce(this, 'navigateTo', { url: '/pages/profile/index' })
  }
})
