const EXPLORATION_VERSION = '0.2.0'
const LEGACY_EXPLORATION_VERSION = '0.1.0'

const questions = [
  {
    id: 'contact_rhythm',
    eyebrow: '联系节奏',
    title: '刚开始认识一个人时，哪种联系节奏最让你舒服？',
    desc: '选择现在最接近你的感受，不需要寻找“正确答案”。',
    options: [
      { value: 'frequent_brief', label: '一天里有多次简短互动' },
      { value: 'daily_clear', label: '不必一直聊天，但每天有一次明确回应' },
      { value: 'spaced_deep', label: '隔一两天认真聊一次也可以' },
      { value: 'depends', label: '很难预先确定，要看当时的感觉' }
    ]
  },
  {
    id: 'response_stability',
    eyebrow: '回应稳定性',
    title: '对方最近回复明显变慢时，哪种做法最能让你安心？',
    desc: '想一想真正能减少猜测的做法，而不是对方应该怎么做。',
    options: [
      { value: 'light_contact', label: '继续保持一些轻松的日常互动' },
      { value: 'explain_return', label: '简单说明最近很忙，之后会再联系' },
      { value: 'follow_up', label: '等忙完后认真回应之前的话题' },
      { value: 'no_explanation', label: '不需要特别说明，我通常不会在意' }
    ]
  },
  {
    id: 'emotional_support',
    eyebrow: '情绪支持',
    title: '你状态不好时，通常最希望亲近的人先做什么？',
    desc: '这里关注的是你最希望先得到什么。',
    options: [
      { value: 'listen', label: '先听我把感受说完' },
      { value: 'stay', label: '安静陪着我，让我知道他在' },
      { value: 'solve', label: '帮我分析并一起找办法' },
      { value: 'space', label: '给我一些独处空间，等我主动开口' }
    ]
  },
  {
    id: 'conflict_pause',
    eyebrow: '分歧之后',
    title: '一次争执开始升温时，哪种处理最能让你继续沟通？',
    desc: '请选择更符合你真实感受的处理方式。',
    options: [
      { value: 'talk_now', label: '当下把问题说清楚，不留到以后' },
      { value: 'pause_with_return', label: '先暂停，但约好大概什么时候继续' },
      { value: 'pause_open', label: '各自冷静，等自然想说时再说' },
      { value: 'confirm_relationship', label: '先确认彼此不是要结束关系，再讨论事情' }
    ]
  },
  {
    id: 'relationship_pace',
    eyebrow: '推进速度',
    title: '你更舒服的关系推进方式是？',
    desc: '不同选择都可能适合不同的人和阶段。',
    options: [
      { value: 'clarify_early', label: '较早说明彼此是否以长期关系为方向' },
      { value: 'steady_natural', label: '保持稳定接触，让关系自然变清楚' },
      { value: 'slow_space', label: '慢一些，给双方足够的个人空间' },
      { value: 'depends', label: '不同的人差异很大，我没有固定偏好' }
    ]
  }
]

const legacyQuestions = [
  {
    id: 'relationship_progression',
    title: '刚认识一个人，对方很快明确表达好感，你通常更接近：',
    options: [
      { value: 'reassured', label: '感到安心，愿意认真推进' },
      { value: 'observe', label: '有些开心，但仍需要观察' },
      { value: 'slow_down', label: '会感到压力，希望慢一点' },
      { value: 'depends_on_feeling', label: '主要取决于我对他的感觉' }
    ]
  },
  {
    id: 'contact_frequency',
    title: '刚开始了解一个人时，怎样的联系频率更让你舒服？',
    options: [
      { value: 'daily', label: '每天保持一些联系' },
      { value: 'natural', label: '有话就聊，不需要固定频率' },
      { value: 'spaced', label: '隔一两天联系也没关系' },
      { value: 'meeting_first', label: '线上频率不重要，更看重见面' }
    ]
  },
  {
    id: 'emotional_response',
    title: '当你状态不好时，你更希望对方：',
    options: [
      { value: 'listen', label: '先听我表达，理解我的感受' },
      { value: 'stay', label: '陪着我，不一定需要说很多' },
      { value: 'solve', label: '帮我分析问题、解决实际困难' },
      { value: 'space', label: '给我一点空间，之后再联系' }
    ]
  },
  {
    id: 'conflict_handling',
    title: '发生不愉快后，你通常更希望：',
    options: [
      { value: 'talk_now', label: '尽快讲清楚' },
      { value: 'cool_then_talk', label: '冷静几个小时，再认真谈' },
      { value: 'let_pass', label: '等情绪过去，不必强行讨论' },
      { value: 'repair_signal', label: '先看到对方愿意修复的态度' }
    ]
  }
]

const emotionalCopy = {
  listen: '状态不好时，你最希望先被听见',
  stay: '状态不好时，安静的陪伴对你更重要',
  solve: '状态不好时，你更希望一起处理实际问题',
  space: '状态不好时，你通常需要先拥有一点自己的空间'
}

const paceCopy = {
  clarify_early: '关系开始时，你更舒服于较早说明长期方向',
  steady_natural: '你更舒服于稳定接触，让关系逐渐变清楚',
  slow_space: '你更舒服于慢一些推进，并保留足够个人空间',
  depends: '你没有固定推进节奏，更愿意根据具体的人判断'
}

function completeFor(questionSet, answers) {
  return questionSet.every(question => answers && question.options.some(option => option.value === answers[question.id]))
}

function hasCurrentAnswers(answers) {
  return completeFor(questions, answers)
}

function hasLegacyAnswers(answers) {
  return completeFor(legacyQuestions, answers)
}

function buildCurrentResult(answers) {
  if (!hasCurrentAnswers(answers)) return null
  let title
  let intro
  let supportingQuestionIds
  let confidenceState

  if (answers.contact_rhythm === 'daily_clear' && ['explain_return', 'follow_up'].includes(answers.response_stability)) {
    title = '你可能更看重回应是否稳定，而不只是联系次数'
    intro = '不必随时在线，但清楚说明、持续出现，以及重要话题会被认真回应，可能更容易让你安心。'
    supportingQuestionIds = ['contact_rhythm', 'response_stability']
    confidenceState = 'initial'
  } else if (answers.conflict_pause === 'pause_with_return' && ['explain_return', 'follow_up'].includes(answers.response_stability)) {
    title = '暂时无法继续时，清楚说明和之后回来回应可能更重要'
    intro = '你可以接受联系或沟通暂停，但会在意暂停是否有说明，以及对方之后会不会回到原来的话题。'
    supportingQuestionIds = ['response_stability', 'conflict_pause']
    confidenceState = 'initial'
  } else {
    title = emotionalCopy[answers.emotional_support]
    intro = `${paceCopy[answers.relationship_pace]}。这只是你刚才的一项明确选择，目前还不足以推断稳定倾向。`
    supportingQuestionIds = ['emotional_support']
    confidenceState = 'direct_fact'
  }

  return {
    version: EXPLORATION_VERSION,
    title,
    intro,
    sections: [{
      label: '还可以继续了解的',
      text: '联系节奏、情绪支持和冲突处理会随关系阶段变化，正式探索会用多道题分别核对。'
    }],
    note: '目前仅根据 5 个选择形成；只有相互支持的回答才会生成初步判断，否则只记录你的明确选择。',
    claim: {
      id: 'exploration.preliminary',
      supportingQuestionIds,
      confidenceState
    },
    generatedAt: Date.now()
  }
}

function buildLegacyResult(answers) {
  if (!hasLegacyAnswers(answers)) return null
  const progression = {
    reassured: ['明确的好感，会让你更容易认真靠近', '关系刚开始时，对方清楚表达好感通常会给你一些确定感，也让你更愿意看看这段关系能走到哪里。'],
    observe: ['你愿意靠近，也会给判断留出时间', '你能够接住对方的好感，但不会仅凭最初的热度做决定。持续的相处和观察，对你同样重要。'],
    slow_down: ['你更适合留有余地的关系开场', '过快的推进可能给你带来压力。比起迅速确认关系，你更希望先建立熟悉感，再决定是否继续靠近。'],
    depends_on_feeling: ['你的推进速度，很看重真实的个人感受', '对方表达得快或慢并不是唯一关键。你更在意自己是否真的被吸引，以及相处时的直观感受。']
  }[answers.relationship_progression]
  const optionText = (questionId, value) => {
    const question = legacyQuestions.find(item => item.id === questionId)
    const option = question && question.options.find(item => item.value === value)
    return option ? option.label : ''
  }
  return {
    version: LEGACY_EXPLORATION_VERSION,
    title: progression[0],
    intro: progression[1],
    sections: [
      { label: '联系与回应', text: `${optionText('contact_frequency', answers.contact_frequency)}；${optionText('emotional_response', answers.emotional_response)}。` },
      { label: '分歧之后', text: optionText('conflict_handling', answers.conflict_handling) }
    ],
    note: '这是旧版 4 题体验结果，原始回答保持不变，不会用新版规则重写。',
    generatedAt: Date.now()
  }
}

function buildExplorationResult(answers) {
  return buildCurrentResult(answers) || buildLegacyResult(answers)
}

function hasCompleteAnswers(answers) {
  return hasCurrentAnswers(answers) || hasLegacyAnswers(answers)
}

function questionSetForAnswers(answers) {
  return hasCurrentAnswers(answers) ? questions : legacyQuestions
}

module.exports = {
  EXPLORATION_VERSION,
  LEGACY_EXPLORATION_VERSION,
  questions,
  legacyQuestions,
  buildExplorationResult,
  hasCompleteAnswers,
  hasCurrentAnswers,
  hasLegacyAnswers,
  questionSetForAnswers
}
