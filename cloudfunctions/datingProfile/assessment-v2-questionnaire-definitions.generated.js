const INSTRUMENT_VERSION = '2.1.1-pilot'
const ASSESSMENT_ID = 'relationship_manual_v2'

const SCALES = {
  A5: { labels: ['完全不符合', '比较不符合', '一半一半 / 不确定', '比较符合', '非常符合'], special: [{ value: 'SKIP', label: '暂时跳过' }] },
  E5: { labels: ['完全不像我', '比较不像我', '一半一半', '比较像我', '非常像我'], special: [{ value: 'NA', label: '不足以判断' }, { value: 'SKIP', label: '暂时跳过' }] },
  N5: { labels: ['完全不需要', '不太需要', '看情境', '比较需要', '非常需要'], special: [{ value: 'SKIP', label: '暂时跳过' }] },
  P5: { labels: ['通常做不到', '较难做到', '有时能做到', '通常能做到', '大多数时候能稳定做到'], special: [{ value: 'NA', label: '没有足够经验' }, { value: 'SKIP', label: '暂时跳过' }] }
}

function item(id, text, scaleId, constructId, options = {}) {
  return Object.assign({ id, text, scaleId, constructId, reverseScored: false, role: 'reflective' }, options)
}

const ITEMS = [
  item('RIN01', '即使暂时没有具体对象，我也愿意认真开始一段以长期相处为方向的关系。', 'A5', 'readiness_intent'),
  item('RIN02', '如果近期遇到合适的人，我愿意为彼此了解留出持续的时间。', 'A5', 'readiness_intent'),
  item('RIN03', '我现在更想维持单身状态，不希望一段关系改变现有生活安排。', 'A5', 'readiness_intent', { reverseScored: true }),
  item('RIN04', '想到进入一段需要投入和承诺的关系，我总体上是愿意的。', 'A5', 'readiness_intent'),
  item('RMV01', '我想开始一段关系，主要因为我确实希望和一个人建立共同生活。', 'A5', 'autonomous_motivation'),
  item('RMV02', '即使家人和周围人不催促，我现在也会想认真认识新的人。', 'A5', 'autonomous_motivation'),
  item('RMV03', '我现在考虑开始一段关系，部分原因是想减少家人、年龄或周围环境带来的压力。', 'A5', 'autonomous_motivation', { reverseScored: true }),
  item('RMV04', '如果暂时没有合适的人，我也不会为了尽快有个交代而开始一段关系。', 'A5', 'autonomous_motivation'),

  item('RCP01', '在未来一个月，我通常能每周留出一段不被工作或家庭打断的相处时间。', 'A5', 'available_capacity'),
  item('RCP02', '我目前有情绪余力关心另一个人的感受，而不只是勉强处理自己的事情。', 'A5', 'available_capacity'),
  item('RCP03', '最近的生活变动让我很难稳定地认识一个人。', 'A5', 'available_capacity', { reverseScored: true }),
  item('RCP04', '即使工作忙，我也能维持双方约定的基本联系。', 'A5', 'available_capacity'),
  item('RPN01', '比起随时在线，我更需要对方的回应节奏大体可预期。', 'N5', 'response_predictability', { role: 'profile', side: 'need' }),
  item('RPN02', '重要话题没有当下答案时，我希望对方明确说之后会回来继续聊。', 'N5', 'response_predictability', { role: 'profile', side: 'need' }),
  item('RPP01', '暂时不能回答重要话题时，我会说明并在约定时间回来继续。', 'P5', 'response_predictability', { role: 'profile', side: 'provide' }),
  item('RPP02', '我的回应节奏大多稳定，不会无解释地忽冷忽热。', 'P5', 'response_predictability', { role: 'profile', side: 'provide' }),

  item('AIS01', '当我在意的人回复明显变慢时，我很难把注意力放回自己的生活。', 'E5', 'uncertainty_sensitivity'),
  item('AIS02', '关系尚未明确时，我常反复猜测对方是不是准备离开。', 'E5', 'uncertainty_sensitivity'),
  item('AIS03', '即使一两次联系不顺，我通常也能等到有更多信息再判断。', 'E5', 'uncertainty_sensitivity', { reverseScored: true }),
  item('AIS04', '我会担心自己在意对方的程度超过了对方在意我的程度。', 'E5', 'uncertainty_sensitivity'),
  item('AIS05', '关系出现距离感时，我需要尽快得到明确回应才能平静。', 'E5', 'uncertainty_sensitivity'),
  item('AIS06', '对方暂时需要空间时，我通常不会立刻把它理解成拒绝我。', 'E5', 'uncertainty_sensitivity', { reverseScored: true }),
  item('REG01', '当我感到关系不稳时，我更可能连续确认、反复发消息或追问。', 'E5', 'REG01', { role: 'observation' }),
  item('REG03', '我能直接说出“我现在有些不安，希望知道你的想法”之类的话。', 'E5', 'REG03', { role: 'observation' }),

  item('AVD01', '当关系变得更亲近时，我仍能坦白表达自己的不安。', 'E5', 'closeness_discomfort', { reverseScored: true }),
  item('AVD02', '遇到难处时，我更愿意自己消化，不希望依靠亲近的人。', 'E5', 'closeness_discomfort'),
  item('AVD03', '我不太舒服让亲近的人看到我脆弱或失控的一面。', 'E5', 'closeness_discomfort'),
  item('AVD04', '我能够接受双方在重要事情上相互依赖。', 'E5', 'closeness_discomfort', { reverseScored: true }),
  item('AVD05', '亲近的人想了解我的内心时，我有时会本能地拉开距离。', 'E5', 'closeness_discomfort'),
  item('AVD06', '持续而稳定的亲密通常不会让我觉得被束缚。', 'E5', 'closeness_discomfort', { reverseScored: true }),
  item('ASN01', '再亲密的关系里，我也需要固定的独处时间。', 'N5', 'autonomy_space', { role: 'profile', side: 'need' }),
  item('ASN02', '即使关系稳定，我也需要双方各自保留一些不共同参与的兴趣和社交。', 'N5', 'autonomy_space', { role: 'profile', side: 'need' }),

  item('ESN01', '我情绪低落时，希望对方先听我说，而不是马上分析对错。', 'N5', 'emotional_support', { role: 'profile', side: 'need' }),
  item('ESN02', '在我明确需要安慰时，对方表达陪伴和在意对我很重要。', 'N5', 'emotional_support', { role: 'profile', side: 'need' }),
  item('ESP01', '对方情绪不好时，我通常能先听完，再问他需要陪伴还是建议。', 'P5', 'emotional_support', { role: 'profile', side: 'provide' }),
  item('ESP02', '即使我不能解决问题，也能用语言或行动让对方知道我在。', 'P5', 'emotional_support', { role: 'profile', side: 'provide' }),
  item('ASP01', '对方提出需要独处时，我通常能先尊重这段空间，而不会继续逼问。', 'P5', 'autonomy_space', { role: 'profile', side: 'provide' }),
  item('ASP02', '我能接受对方保留自己的朋友、兴趣和安排。', 'P5', 'autonomy_space', { role: 'profile', side: 'provide' }),
  item('REG02', '当关系有压力时，我更可能减少回应、搁置话题或暂时消失。', 'E5', 'REG02', { role: 'observation' }),
  item('REG04', '我需要暂停时，通常会说明原因，以及大概什么时候再聊。', 'E5', 'REG04', { role: 'observation' }),

  item('CPN01', '争执升温时，我更希望先暂停一段时间，再继续讨论。', 'N5', 'conflict_pause', { role: 'profile', side: 'need' }),
  item('CPN02', '争执暂停后，我需要有不必当天解决问题的余地，只要双方约好何时继续。', 'N5', 'conflict_pause', { role: 'profile', side: 'need' }),
  item('CPP01', '情绪上来时，我能明确提出暂停，并说明大概何时回来继续。', 'P5', 'conflict_pause', { role: 'profile', side: 'provide' }),
  item('CPP02', '暂停期间，我通常不会故意失联来惩罚对方。', 'P5', 'conflict_pause', { role: 'profile', side: 'provide' }),
  item('RRN01', '分歧后，即使问题还没完全解决，我也需要双方确认这段关系仍值得继续。', 'N5', 'repair_reengagement', { role: 'profile', side: 'need' }),
  item('RRN02', '冲突后，我希望对方能主动开启一次修复对话，而不是等事情自然过去。', 'N5', 'repair_reengagement', { role: 'profile', side: 'need' }),
  item('RRP01', '冷静后，我通常会主动回到问题，并尝试理解对方的感受。', 'P5', 'repair_reengagement', { role: 'profile', side: 'provide' }),
  item('RRP02', '发现自己伤到对方时，我能具体承认造成的影响，而不只解释自己的动机。', 'P5', 'repair_reengagement', { role: 'profile', side: 'provide' })
]

const CHAPTERS = [
  { id: 'C1', title: '我为什么想开始', theme: '关系意愿与自己的选择', instruction: '请根据你现在以及未来一个月的真实状态回答。', itemIds: ITEMS.slice(0, 8).map(x => x.id) },
  { id: 'C2', title: '我现在有没有空间', theme: '现实余力与回应的连续性', instruction: '想想未来一个月真实可用的时间和情绪空间。', itemIds: ITEMS.slice(8, 16).map(x => x.id) },
  { id: 'C3', title: '关系不明确时，我会怎样', theme: '距离变化与常见反应', instruction: '请回想过去的恋爱、暧昧，或你曾经很在意的一段关系。', itemIds: ITEMS.slice(16, 24).map(x => x.id) },
  { id: 'C4', title: '关系靠近之后', theme: '亲近、依赖与个人空间', instruction: '没有足够经验时，可以选择“不足以判断”。', itemIds: ITEMS.slice(24, 32).map(x => x.id) },
  { id: 'C5', title: '怎样被理解，也怎样对待对方', theme: '情绪支持与彼此空间', instruction: '需要什么和通常能做到什么是两件不同的事。', itemIds: ITEMS.slice(32, 40).map(x => x.id) },
  { id: 'C6', title: '分歧之后怎样回来', theme: '暂停、修复与重新靠近', instruction: '请按过去通常能否做到回答，而不是按理想中的自己回答。', itemIds: ITEMS.slice(40, 48).map(x => x.id) }
]

const DIMENSIONS = {
  readiness_intent: { title: '进入关系的真实意愿', minimum: 3, kind: 'reflective' },
  autonomous_motivation: { title: '关系追求的自主性', minimum: 3, kind: 'reflective' },
  available_capacity: { title: '当前可以投入的余力', minimum: 3, kind: 'reflective' },
  uncertainty_sensitivity: { title: '面对关系不确定的敏感', minimum: 4, kind: 'reflective' },
  closeness_discomfort: { title: '对亲近与依赖的不适', minimum: 4, kind: 'reflective' },
  response_predictability: { title: '回应可预期性', kind: 'profile' },
  emotional_support: { title: '情绪支持', kind: 'profile' },
  autonomy_space: { title: '个人空间', kind: 'profile' },
  conflict_pause: { title: '冲突暂停', kind: 'profile' },
  repair_reengagement: { title: '修复与重新靠近', kind: 'profile' }
}

function getItem(itemId) { return ITEMS.find(current => current.id === itemId) || null }
function getChapter(chapterId) { return CHAPTERS.find(current => current.id === chapterId) || null }
function optionsFor(itemValue) {
  const scale = SCALES[itemValue.scaleId]
  return scale.labels.map((label, index) => ({ value: index + 1, label })).concat(scale.special)
}

module.exports = { ASSESSMENT_ID, INSTRUMENT_VERSION, SCALES, ITEMS, CHAPTERS, DIMENSIONS, getItem, getChapter, optionsFor }
