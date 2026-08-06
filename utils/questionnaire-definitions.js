const QUESTIONNAIRE_SCHEMA_VERSION = 'questionnaire-definitions-0.1.0'

const RESPONSE_SCALES = {
  A5: {
    id: 'A5',
    values: [1, 2, 3, 4, 5, 'SKIP'],
    labels: ['完全不符合', '比较不符合', '一半一半/不确定', '比较符合', '非常符合', '暂时跳过']
  },
  E5: {
    id: 'E5',
    values: [1, 2, 3, 4, 5, 'NA', 'SKIP'],
    labels: ['完全不像我', '比较不像我', '一半一半', '比较像我', '非常像我', '不足以判断', '暂时跳过']
  },
  N5: {
    id: 'N5',
    values: [1, 2, 3, 4, 5, 'SKIP'],
    labels: ['完全不需要', '不太需要', '看情境', '比较需要', '非常需要', '暂时跳过']
  },
  P5: {
    id: 'P5',
    values: [1, 2, 3, 4, 5, 'NA', 'SKIP'],
    labels: ['通常做不到', '较难做到', '有时能做到', '通常能做到', '大多数时候能稳定做到', '没有足够经验', '暂时跳过']
  }
}

function item(id, text, scaleId, dimensionId, options = {}) {
  return Object.assign({
    id,
    text,
    scaleId,
    dimensionId,
    reverseScored: false,
    scoringRole: 'dimension'
  }, options)
}

const readinessItems = [
  item('RIN01', '即使暂时没有具体对象，我也愿意认真开始一段以长期相处为方向的关系。', 'A5', 'readiness_intent'),
  item('RIN02', '如果近期遇到合适的人，我愿意为彼此了解留出持续的时间。', 'A5', 'readiness_intent'),
  item('RIN03', '我现在更想维持单身状态，不希望一段关系改变现有生活安排。', 'A5', 'readiness_intent', { reverseScored: true }),
  item('RIN04', '想到进入一段需要投入和承诺的关系，我总体上是愿意的。', 'A5', 'readiness_intent'),
  item('RCP01', '在未来一个月，我通常能每周留出一段不被工作或家庭打断的相处时间。', 'A5', 'available_capacity'),
  item('RCP02', '我目前有余力回应另一个人的情绪和日常，而不只是勉强处理自己的事情。', 'A5', 'available_capacity'),
  item('RCP03', '最近的生活变动让我很难稳定地认识一个人。', 'A5', 'available_capacity', { reverseScored: true }),
  item('RCP04', '即使工作忙，我也能提前说明情况并维持基本的联系。', 'A5', 'available_capacity'),
  item('RUN01', '刚认识时对方回复节奏变化，我能先观察和沟通，而不是立刻认定没有希望。', 'A5', 'early_uncertainty'),
  item('RUN02', '在关系还没确定前，我愿意主动提出一次见面或继续了解。', 'A5', 'early_uncertainty'),
  item('RUN03', '如果短期内得不到明确答案，我通常会很快退出，以避免继续不安。', 'A5', 'early_uncertainty', { reverseScored: true }),
  item('RUN04', '我能接受了解一个人需要几次接触，结论不必在第一次见面后形成。', 'A5', 'early_uncertainty'),
  item('RMV01', '我想开始一段关系，主要因为我确实希望和一个人建立共同生活。', 'A5', 'autonomous_motivation'),
  item('RMV02', '即使家人和周围人不催促，我现在也会想认真认识新的人。', 'A5', 'autonomous_motivation'),
  item('RMV03', '我参加这次登记，主要是为了减少家人、年龄或周围环境带来的压力。', 'A5', 'autonomous_motivation', { reverseScored: true }),
  item('RMV04', '如果暂时没有合适的人，我也不会为了尽快有个交代而开始一段关系。', 'A5', 'autonomous_motivation')
]

const interactionItems = [
  item('AIS01', '当我在意的人回复明显变慢时，我很难把注意力放回自己的生活。', 'E5', 'uncertainty_sensitivity'),
  item('AIS02', '关系尚未明确时，我常反复猜测对方是不是准备离开。', 'E5', 'uncertainty_sensitivity'),
  item('AIS03', '即使一两次联系不顺，我通常也能等到有更多信息再判断。', 'E5', 'uncertainty_sensitivity', { reverseScored: true }),
  item('AIS04', '我会担心自己在意对方的程度超过了对方在意我的程度。', 'E5', 'uncertainty_sensitivity'),
  item('AIS05', '关系出现距离感时，我需要尽快得到明确回应才能平静。', 'E5', 'uncertainty_sensitivity'),
  item('AIS06', '对方暂时需要空间时，我通常不会立刻把它理解成拒绝我。', 'E5', 'uncertainty_sensitivity', { reverseScored: true }),
  item('AVD01', '当关系变得更亲近时，我仍能坦白表达自己的需要和不安。', 'E5', 'closeness_discomfort', { reverseScored: true }),
  item('AVD02', '遇到难处时，我更愿意自己消化，不希望依靠亲近的人。', 'E5', 'closeness_discomfort'),
  item('AVD03', '我不太舒服让亲近的人看到我脆弱或失控的一面。', 'E5', 'closeness_discomfort'),
  item('AVD04', '我能够接受双方在重要事情上相互依赖。', 'E5', 'closeness_discomfort', { reverseScored: true }),
  item('AVD05', '亲近的人想了解我的内心时，我有时会本能地拉开距离。', 'E5', 'closeness_discomfort'),
  item('AVD06', '持续而稳定的亲密通常不会让我觉得被束缚。', 'E5', 'closeness_discomfort', { reverseScored: true }),
  item('REG01', '当我感到关系不稳时，我更可能连续确认、反复发消息或追问。', 'E5', 'interaction_regulation', { scoringRole: 'observation' }),
  item('REG02', '当关系有压力时，我更可能减少回应、搁置话题或暂时消失。', 'E5', 'interaction_regulation', { scoringRole: 'observation' }),
  item('REG03', '我能直接说出“我现在有些不安，希望知道你的想法”之类的话。', 'E5', 'interaction_regulation', { scoringRole: 'observation' }),
  item('REG04', '我需要暂停时，通常会说明原因，以及大概什么时候再聊。', 'E5', 'interaction_regulation', { scoringRole: 'observation' })
]

const needsItems = [
  item('CRN01', '即使双方都很忙，我也希望每天至少有一次简短但明确的联系。', 'N5', 'contact_rhythm', { side: 'need' }),
  item('CRN02', '即使一两天没有联系，只要关系没有异常，我也能感到稳定。', 'N5', 'contact_rhythm', { side: 'need', reverseScored: true }),
  item('CRP01', '工作忙时，我通常也能发一条消息说明情况。', 'P5', 'contact_rhythm', { side: 'provide' }),
  item('CRP02', '在没有特别话题时，我仍能维持双方约定的联系节奏。', 'P5', 'contact_rhythm', { side: 'provide' }),
  item('RPN01', '比起随时在线，我更需要对方的回应节奏大体可预期。', 'N5', 'response_predictability', { side: 'need' }),
  item('RPN02', '重要话题没有当下答案时，我希望对方明确说之后会回来继续聊。', 'N5', 'response_predictability', { side: 'need' }),
  item('RPP01', '暂时不能回答重要话题时，我会说明并在约定时间回来继续。', 'P5', 'response_predictability', { side: 'provide' }),
  item('RPP02', '我的回应节奏大多稳定，不会无解释地忽冷忽热。', 'P5', 'response_predictability', { side: 'provide' }),
  item('ESN01', '我情绪低落时，希望对方先听我说，而不是马上分析对错。', 'N5', 'emotional_support', { side: 'need' }),
  item('ESN02', '在我明确需要安慰时，陪伴、拥抱或一句确认对我很重要。', 'N5', 'emotional_support', { side: 'need' }),
  item('ESP01', '对方情绪不好时，我通常能先听完，再问他需要陪伴还是建议。', 'P5', 'emotional_support', { side: 'provide' }),
  item('ESP02', '即使我不能解决问题，也能用语言或行动让对方知道我在。', 'P5', 'emotional_support', { side: 'provide' }),
  item('ASN01', '再亲密的关系里，我也需要固定的独处时间。', 'N5', 'autonomy_space', { side: 'need' }),
  item('ASN02', '对方不参与我的每项兴趣和社交，我仍能感到关系稳定。', 'N5', 'autonomy_space', { side: 'need' }),
  item('ASP01', '对方提出需要独处时，我通常能尊重，而不是立刻追问或冷落他。', 'P5', 'autonomy_space', { side: 'provide' }),
  item('ASP02', '我能接受对方保留自己的朋友、兴趣和安排。', 'P5', 'autonomy_space', { side: 'provide' }),
  item('CPN01', '争执升温时，我更希望先暂停一段时间，再继续讨论。', 'N5', 'conflict_pause', { side: 'need' }),
  item('CPN02', '暂停时，如果对方说明何时再谈，我可以接受当天不把问题解决。', 'N5', 'conflict_pause', { side: 'need' }),
  item('CPP01', '情绪上来时，我能明确提出暂停，并说明大概何时回来继续。', 'P5', 'conflict_pause', { side: 'provide' }),
  item('CPP02', '暂停期间，我不会用失联、威胁结束关系或公开抱怨来惩罚对方。', 'P5', 'conflict_pause', { side: 'provide' }),
  item('RRN01', '分歧后，即使问题还没完全解决，我也需要双方确认这段关系仍值得继续。', 'N5', 'repair_reengagement', { side: 'need' }),
  item('RRN02', '冲突后，我希望对方能主动开启一次修复对话，而不是等事情自然过去。', 'N5', 'repair_reengagement', { side: 'need' }),
  item('RRP01', '冷静后，我通常会主动回到问题，并尝试理解对方的感受。', 'P5', 'repair_reengagement', { side: 'provide' }),
  item('RRP02', '发现自己伤到对方时，我能具体承认造成的影响，而不只解释自己的动机。', 'P5', 'repair_reengagement', { side: 'provide' })
]

const MODULES = [
  {
    id: 'current_relationship_readiness',
    version: '0.1.0',
    status: 'draft',
    sourceType: 'self_authored',
    shortTitle: '当前关系状态',
    title: '我现在适合开始一段关系吗',
    instruction: '请根据你现在以及未来一个月的真实状态回答。',
    minimumByDimension: 3,
    dimensions: [
      { id: 'readiness_intent', title: '进入关系的真实意愿' },
      { id: 'available_capacity', title: '当前可以投入的余力' },
      { id: 'early_uncertainty', title: '面对早期不确定' },
      { id: 'autonomous_motivation', title: '这件事是不是我自己想要' }
    ],
    items: readinessItems
  },
  {
    id: 'intimate_interaction_style',
    version: '0.1.0',
    status: 'draft',
    sourceType: 'self_authored',
    shortTitle: '亲密互动方式',
    title: '我怎样靠近一个人',
    instruction: '请回想过去的恋爱、暧昧，或你曾经很在意的一段亲密关系。',
    minimumByDimension: 4,
    dimensions: [
      { id: 'uncertainty_sensitivity', title: '关系不明确时的敏感' },
      { id: 'closeness_discomfort', title: '亲近与依赖的不适' },
      { id: 'interaction_regulation', title: '常见应对动作', scoringRole: 'observation' }
    ],
    items: interactionItems
  },
  {
    id: 'needs_and_provision',
    version: '0.1.0',
    status: 'draft',
    sourceType: 'self_authored_behavioral_profile',
    shortTitle: '需要与能够提供',
    title: '我需要怎样的相处，也通常能提供什么',
    instruction: '需要和能够提供是两件不同的事，请分别按真实情况回答。',
    dimensions: [
      { id: 'contact_rhythm', title: '联系节奏' },
      { id: 'response_predictability', title: '回应是否可预期' },
      { id: 'emotional_support', title: '情绪支持' },
      { id: 'autonomy_space', title: '个人空间' },
      { id: 'conflict_pause', title: '冲突暂停' },
      { id: 'repair_reengagement', title: '修复与重新靠近' }
    ],
    items: needsItems
  }
]

function getModule(moduleId) {
  return MODULES.find(module => module.id === moduleId) || null
}

function getItem(itemId) {
  for (const module of MODULES) {
    const found = module.items.find(current => current.id === itemId)
    if (found) return Object.assign({ moduleId: module.id, instrumentVersion: module.version }, found)
  }
  return null
}

module.exports = {
  QUESTIONNAIRE_SCHEMA_VERSION,
  RESPONSE_SCALES,
  MODULES,
  getModule,
  getItem
}
