const { CONTENT_VERSION } = require('./version')

module.exports = Object.freeze({
  CONTENT_VERSION,
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
    topics: ['你现在到底想不想开始', '对方一变，你会怎么反应', '真正靠近以后，你需要多大空间', '难受和吵架时，你希望两个人怎么处理']
  }),
  guide: Object.freeze({
    title: '这些问题不是随便编的',
    body: '问题参考了成人依恋、关系投入、伴侣回应、冲突处理等关系研究。但这一整套问卷目前仍是我们自己设计的试点版本，不是心理诊断，也不是已经标准化的心理量表。',
    focus: '我们更关心的是：这些问题能不能帮你把真实的相处方式说得更清楚。'
  }),
  storage: Object.freeze({
    title: '要不要把进度存到云端？',
    body: '存到云端后，换设备也能继续，报告和你之后的修改也会一起保留。这里只用于保存你的这次填写。访谈、研究或其他用途都会另外征求你的同意。',
    cloud: '保存到云端',
    local: '只存在这台手机'
  })
})
