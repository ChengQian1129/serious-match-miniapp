const { CONTENT_VERSION } = require('./version')

module.exports = Object.freeze({
  CONTENT_VERSION,
  welcome: Object.freeze({
    kicker: '关系说明书',
    title: '有些事，遇到一个人之前\n就可以先想明白。',
    intro: '比如：',
    questions: ['对方突然比以前冷一点，你真正介意的是什么？', '两个人越来越亲近以后，你还需要多少自己的空间？', '吵起来的时候，你更想马上说清楚，还是先停一会儿？'],
    boundary: '这里不会给你分人格类型。',
    closing: '只是把这些关系里真的会发生的事，一件件问清楚。',
    meta: '48 个问题 · 大约 8–12 分钟 · 可以随时停下来',
    action: '开始看看',
    methodAction: '这些问题怎么来的？'
  }),
  home: Object.freeze({
    kicker: '关系说明书',
    title: '先把自己的那部分弄清楚。',
    description: '不是问理想中的你应该怎样。这里问的是：真的遇到这些情况时，你通常会怎样。',
    exampleLabel: '比如',
    example: '对方回复突然比以前慢很多。你更在意的是他回得慢，还是他变了，却没有告诉你为什么？',
    action: '开始看看',
    guideAction: '这些问题怎么来的？',
    progressTitle: '上次答到这里。',
    completedTitle: '你的说明书已经在这里了。',
    completedDescription: '你可以重新看，也可以改之前的回答。有些判断在经历变化以后，本来就可能不同。',
    topicsTitle: '会聊到这些事',
    topics: ['你现在到底想不想开始', '对方一变，你会怎么反应', '真正靠近以后，你需要多大空间', '难受和吵架时，你希望两个人怎么处理'],
    followupHint: '完成报告后，你可以选择了解后续访谈、模型研究或线下活动。它们不会影响你查看和修改自己的报告。'
  }),
  guide: Object.freeze({
    title: '这些问题不是随便编的',
    body: '问题参考了成人依恋、关系投入、伴侣回应和冲突处理等关系研究。\n\n但这一整套问卷目前仍是项目自己设计的试点版本，不是心理诊断，也不是已经标准化的心理量表。',
    focus: '我们真正想知道的是：这些问题能不能帮你把真实的相处方式说得更清楚。',
    detailAction: '查看完整方法说明',
    closeAction: '知道了'
  }),
  storage: Object.freeze({
    title: '要不要把进度存到云端？',
    body: '存到云端后，换设备也能继续，报告和你之后的修改也会一起保留。这里只用于保存你的这次填写。访谈、研究或其他用途都会另外征求你的同意。',
    cloud: '保存到云端',
    local: '只存在这台手机'
  }),
  privacy: Object.freeze({
    operator: '试点运营主体：钱程',
    contact: '联系运营者：通过小程序客服入口（公开测试前需在微信公众平台配置）',
    retentionTitle: '保存多久',
    retention: '问卷和关系说明书保留到你删除为止。参与资料和联系方式在撤回或删除登记后清除；去标识化研究记录最多保留到试点结束后 12 个月，之后删除或汇总为不能识别个人的统计结果。',
    rightsTitle: '你可以做什么',
    rights: '你可以查看、更正、撤回后续用途授权，或删除参与登记、问卷和关系说明书。撤回不会影响已经生成的个人报告。',
    releaseTitle: '公开测试前检查',
    release: '正式公开测试前，运营主体需要确认客服入口、保存期限和用户权利说明，并在微信公众平台完成相应配置。'
  })
})
