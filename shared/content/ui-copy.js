const { CONTENT_VERSION } = require('./version')

module.exports = Object.freeze({
  CONTENT_VERSION,
  welcome: Object.freeze({
    kicker: '',
    title: '先看看自己谈恋爱时会怎么想、怎么做。',
    intro: '比如：',
    questions: [
      '对方突然比以前冷一点，你真正介意的是什么？',
      '两个人越来越亲近以后，你还需要多少自己的空间？',
      '吵起来的时候，你更想马上说清楚，还是先停一会儿？'
    ],
    boundary: '这里不会给你分人格类型。',
    closing: '',
    meta: '整套问题比较多，可以分几次完成，随时停下来。',
    action: '开始答题',
    methodAction: '这些问题怎么来的？',
    privacyAction: '隐私说明'
  }),
  home: Object.freeze({
    kicker: '',
    title: '开始答题',
    titleFirstTime: '开始答题',
    titleResume: '继续答题',
    description: '这些题问的都是实际可能遇到的情况。可以分几次完成，按你平时最可能的反应回答就行。',
    exampleLabel: '比如',
    example: '对方回复突然比以前慢很多。你更在意的是回得慢，还是他变了，却没告诉你为什么？',
    action: '开始答题',
    guideAction: '这些问题怎么来的？',
    progressTitle: '上次答到这里',
    completedTitle: '已经做完了',
    completedDescription: '可以重新看结果，也可以改之前的回答。',
    progressDescriptionTemplate: '已经完成 {completed} / {total} 组，之前的回答都还在。',
    privacyAction: '隐私说明',
    deleteAction: '删除这次回答',
    deleteDialogTitle: '删除这次回答？',
    deleteDialogContent: '会删除本机和云端保存的本次问卷、结果和修改记录，删除后不能恢复。',
    deleteConfirm: '确认删除',
    deleteCancel: '取消',
    deleteSuccess: '已删除',
    retryAction: '点击重试',
    topicsTitle: '会问到这些',
    topics: [
      '你现在想不想谈恋爱',
      '对方态度变了，你通常会怎样',
      '关系越来越亲近以后，你需要多少自己的空间',
      '难受或吵架时，你希望两个人怎么处理'
    ],
    followupHint: '做完以后，如果你愿意，还可以了解一对一访谈或大连的线下交流。'
  }),
  guide: Object.freeze({
    title: '这些问题从哪里来？',
    body: '这些问题参考了一些关于恋爱关系、相处方式和冲突处理的研究。现在这套题还在试用和调整，不是心理诊断，也不是专业机构使用的标准测试。',
    focus: '我们会继续看哪些问题真正有用、哪些地方需要改。',
    detailAction: '查看方法说明',
    closeAction: '知道了'
  }),
  privacy: Object.freeze({
    operator: '运营者：钱程',
    contact: '联系运营者：通过小程序客服',
    retentionTitle: '保存多久',
    retention: '问卷和结果会保存到你主动删除为止。你留下的联系信息会在你撤回或删除后清除。做研究分析时，我们会先去掉能直接识别你的信息；这类记录最多保留到试点结束后 12 个月，之后删除，或只保留无法识别个人的统计结果。',
    rightsTitle: '你可以做什么',
    rights: '你可以查看和修改自己的回答，也可以随时撤回后续联系的授权，或删除问卷、结果和联系信息。'
  })
})
