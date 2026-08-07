const { getChapter, getItem, optionsFor } = require('./questionnaire-definitions')
const { evaluateAssessment, scored, missing } = require('./scoring-engine')
const { buildReport } = require('./report-engine')

const PRESENT = new Set(['strong_present', 'lean_present'])
const LESS = new Set(['strong_less', 'lean_less'])

function answerEvidence(chapter, answers) {
  return chapter.itemIds.map((itemId, index) => {
    const item = getItem(itemId)
    const rawValue = answers[itemId]
    if (!item || missing(rawValue)) return null
    const option = optionsFor(item).find(current => current.value === rawValue)
    return {
      itemId,
      question: item.text,
      answer: option ? option.label : '暂未判断',
      strength: Math.abs(scored(item, rawValue) - 3),
      index
    }
  }).filter(Boolean).sort((left, right) => right.strength - left.strength || left.index - right.index).slice(0, 3)
}

function reflectiveSignal(dimension, highText, lowText, mixedText) {
  if (!dimension || dimension.state === 'insufficient') return '这一部分暂时没有足够回答形成判断。'
  if (PRESENT.has(dimension.state)) return highText
  if (LESS.has(dimension.state)) return lowText
  return mixedText
}

function profileSignal(dimension, side, clearText, lowText, mixedText) {
  if (!dimension) return '这一部分暂时没有足够回答形成判断。'
  const state = side === 'need' ? dimension.needState : dimension.provideState
  if (state === 'need_clear' || state === 'provide_stable') return clearText
  if (state === 'need_lower' || state === 'provide_constrained') return lowText
  if (state === 'need_insufficient' || state === 'provide_uncertain') return '这一部分暂时没有足够回答形成判断。'
  return mixedText
}

function chapterNarrative(chapterId, evaluation) {
  const dimensions = evaluation.dimensions
  const observations = evaluation.observations

  if (chapterId === 'C1') {
    const willing = PRESENT.has(dimensions.readiness_intent.state)
    const selfDirected = PRESENT.has(dimensions.autonomous_motivation.state)
    const hesitant = LESS.has(dimensions.readiness_intent.state)
    return {
      title: willing && selfDirected ? '你想开始，而且更希望这是自己的选择' : willing ? '你有开始的愿望，但也在分辨谁在推动你' : hesitant ? '你现在并不急着把自己放进一段关系' : '你对开始关系的态度，带着真实的两面性',
      text: willing && selfDirected ? '你的回答同时指向两件事：你愿意为长期相处投入，也不想为了年龄、家人或“该有个结果”而仓促开始。对你来说，合适比尽快更重要。' : willing ? '你并不是不想进入关系；只是个人愿望与外部压力目前交织在一起。真正需要确认的，不是“要不要赶快开始”，而是什么样的人和关系值得你投入。' : hesitant ? '你的回答更接近保留现有生活，而不是马上承担一段关系的投入。这不等于拒绝亲密，只说明此刻的你更看重开始的理由是否充分。' : '你的一部分回答愿意靠近长期关系，另一部分又在保护现在的生活节奏。它更像“有条件地愿意”，而不是简单的想或不想。',
      signals: [
        { label: '开始意愿', text: reflectiveSignal(dimensions.readiness_intent, '愿意认真认识一个人，也接受关系需要持续投入。', '目前更倾向维持现状，不急于进入承诺关系。', '对靠近有期待，也对投入后的改变有所保留。') },
        { label: '决定来源', text: reflectiveSignal(dimensions.autonomous_motivation, '即使没有外界催促，你也更可能按自己的意愿开始。', '家人、年龄或周围节奏可能正在明显推动这个决定。', '个人愿望和外部推动都在起作用，暂时很难完全分开。') }
      ],
      impact: '进入实际关系时，你可能更在意“这是我真正想选的人”，而不是仅仅确认对方条件合格。'
    }
  }

  if (chapterId === 'C2') {
    return {
      title: PRESENT.has(dimensions.available_capacity.state) ? '你不只是在想开始，也在为关系留位置' : LESS.has(dimensions.available_capacity.state) ? '想认识一个人，和现在有余力投入并不是一回事' : '你的投入空间取决于现实节奏是否稳定',
      text: PRESENT.has(dimensions.available_capacity.state) ? '从时间、情绪带宽和联系连续性看，你目前有一定条件让了解持续发生。你看重的也不是随时在线，而是重要回应有交代、有下文。' : LESS.has(dimensions.available_capacity.state) ? '目前的工作、生活变化或情绪负荷，可能让持续认识一个人变得吃力。与其承诺高频联系，更适合先说清真正可用的时间。' : '你并非完全没有空间，但这种空间可能不够稳定。关系能否舒服推进，很大程度取决于双方能不能把忙碌、回复和下一次联系说清楚。',
      signals: [
        { label: '现实余力', text: reflectiveSignal(dimensions.available_capacity, '近期有时间和情绪空间维持持续了解。', '近期可投入的时间或情绪余力比较有限。', '有些时候能投入，有些时候现实安排会明显挤压关系。') },
        { label: '回应节奏', text: profileSignal(dimensions.response_predictability, 'need', '你需要的不是秒回，而是重要话题不会无解释地中断。', '你对固定、可预期的回应节奏要求不高。', '你对回应节奏的需要会随话题重要性和情境变化。') }
      ],
      impact: '比起提高联系频率，提前约定“忙时怎么说、什么时候回来”更可能提升你的安全感。'
    }
  }

  if (chapterId === 'C3') {
    const sensitivity = dimensions.uncertainty_sensitivity
    return {
      title: PRESENT.has(sensitivity.state) ? '关系一旦变得不明确，你会很快捕捉到距离变化' : LESS.has(sensitivity.state) ? '面对短暂的距离变化，你通常能先等等看' : '你对距离变化的反应，会随在意程度而改变',
      text: PRESENT.has(sensitivity.state) ? '回复变慢、态度不清或关系未定时，你的注意力可能迅速转向“是不是哪里出了问题”。这种敏感能让你很早察觉变化，也可能让一次普通波动显得格外重要。' : LESS.has(sensitivity.state) ? '一两次联系不顺时，你较能保留判断，等待更多信息，而不是立刻把距离理解成拒绝。真正重要的是，你是否也能在需要时直接说出不安。' : '你并非一直敏感或一直稳定：有些距离变化你能等待，有些会触发反复猜测。对象的重要性和关系是否有明确约定，可能是关键差别。',
      signals: [
        { label: '不确定敏感', text: reflectiveSignal(sensitivity, '关系信号变弱时，你较容易持续关注并寻求确定。', '你通常能容纳短暂的不确定，不急着得出负面结论。', '你能等待更多信息，但特定情境仍可能明显触发担心。') },
        { label: '常见动作', text: observations.REG03 === 'active' ? '你倾向尝试直接表达不安和需要。' : observations.REG01 === 'active' ? '不安升高时，你可能通过追问或反复确认尽快获得答案。' : '目前没有一个特别明确、反复出现的应对动作。' }
      ],
      impact: '对你有帮助的不是压住敏感，而是把“我观察到什么、我担心什么、我想确认什么”分开表达。'
    }
  }

  if (chapterId === 'C4') {
    return {
      title: PRESENT.has(dimensions.closeness_discomfort.state) ? '你想靠近，但也会本能地保护自己的内部空间' : LESS.has(dimensions.closeness_discomfort.state) ? '稳定的亲近对你来说通常不是负担' : '你能接受亲近，同时需要保留可呼吸的距离',
      text: PRESENT.has(dimensions.closeness_discomfort.state) ? '当关系要求暴露脆弱、接受依赖或持续分享内心时，你可能先自己消化，甚至短暂拉开距离。这不等于不在意，而是亲近越深，失去自主的风险也越真实。' : LESS.has(dimensions.closeness_discomfort.state) ? '你相对能接受彼此依赖，也不容易把持续亲近直接理解成束缚。与此同时，能否保留各自兴趣和独处，仍会影响亲密是否长久。' : '你并不排斥依赖和坦白，但不会在所有情境里都同样自在。关系越稳定、边界越清楚，你越可能放心靠近。',
      signals: [
        { label: '亲近感受', text: reflectiveSignal(dimensions.closeness_discomfort, '展现脆弱或依赖他人时，你更容易感到不自在。', '你通常能接受相互依赖和持续的情感靠近。', '你对亲近既有接纳，也会在一些情境里退回自己的空间。') },
        { label: '个人空间', text: profileSignal(dimensions.autonomy_space, 'need', '即使关系稳定，你仍明确需要独处和各自的生活部分。', '你对固定独处或各自安排的需要相对较低。', '你是否需要空间，会随关系状态和现实安排变化。') }
      ],
      impact: '让亲密更舒服的关键，可能是把“我需要一点空间”和“我不想要这段关系”明确区分。'
    }
  }

  if (chapterId === 'C5') {
    return {
      title: '你在意的，是被怎样接住，也包括怎样给对方空间',
      text: '这一章把“我需要什么”和“我通常能给出什么”分开看。两者不必完全对称；真正值得留意的是，你能否把自己的需要说清，也能否识别对方需要陪伴还是空间。',
      signals: [
        { label: '被理解的方式', text: profileSignal(dimensions.emotional_support, 'need', '情绪低落时，你明确需要先被听见和陪伴，而不是马上被分析。', '你对情绪陪伴的明确需求相对较低。', '你需要的支持方式比较看情境，不总是同一种。') },
        { label: '你能给出的', text: profileSignal(dimensions.emotional_support, 'provide', '你通常能先听完，再确认对方需要陪伴还是建议。', '在对方情绪较重时，你可能较难稳定提供回应。', '你有时能提供情绪支持，但稳定性可能受自身状态影响。') },
        { label: '对方的空间', text: profileSignal(dimensions.autonomy_space, 'provide', '你通常能尊重对方的独处、朋友和个人安排。', '对方拉开距离时，你可能较难立即给出空间。', '你能否给出空间，可能取决于关系当时是否足够稳定。') }
      ],
      impact: '相处中可以少猜一步：先问“你现在想让我听，还是想一起想办法？”往往比直接解决问题更有效。'
    }
  }

  return {
    title: '你更需要的不是立刻解决，而是暂停之后还能回来',
    text: '你对冲突的期待不只涉及要不要暂停，还涉及暂停是否有说明、关系是否仍被确认，以及冷静后谁来重新开启对话。这些细节决定暂停是在保护关系，还是让问题失去下文。',
    signals: [
      { label: '暂停方式', text: profileSignal(dimensions.conflict_pause, 'need', '争执升温时，你明确需要先暂停，并约好何时继续。', '你更倾向当下处理分歧，对暂停的需要较低。', '是否需要暂停，会随冲突强度和问题类型变化。') },
      { label: '重新靠近', text: profileSignal(dimensions.repair_reengagement, 'need', '冲突后，你需要明确确认关系，并有人主动开启修复。', '你对正式修复对话的需要相对较低。', '你需要修复，但对时机和由谁发起还没有固定偏好。') },
      { label: '你能做到的', text: profileSignal(dimensions.repair_reengagement, 'provide', '冷静后，你通常能回到问题并承认具体影响。', '冷静后主动回到问题，对你来说可能仍有难度。', '你有修复意愿，但能否落实会受到当时情绪影响。') }
    ],
    impact: '对你而言，有效暂停最好包含三个信息：为什么停、关系还在不在、什么时候回来。'
  }
}

function buildChapterInsight(chapterId, answers) {
  const chapter = getChapter(chapterId)
  if (!chapter) throw new Error(`未知章节 ${chapterId}`)
  const evaluation = evaluateAssessment(answers)
  const report = buildReport(answers)
  const sourceSet = new Set(chapter.itemIds)
  const relevant = report.allClaimCandidates.filter(claim => [].concat(claim.supportingItemIds || [], claim.contradictingItemIds || [], claim.qualifyingItemIds || []).some(id => sourceSet.has(id))).slice(0, 3)
  const narrative = chapterNarrative(chapterId, evaluation)
  return Object.assign({
    chapterId,
    boundary: '这是根据你此刻的自述形成的阶段判断，不是固定人格，也不是心理诊断。',
    evidence: answerEvidence(chapter, answers),
    claims: relevant
  }, narrative)
}

module.exports = { buildChapterInsight }
