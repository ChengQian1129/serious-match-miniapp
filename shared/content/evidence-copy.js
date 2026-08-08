module.exports = Object.freeze({
  why: '为什么会有这句话',
  supporting: '为什么会有这句话',
  contradicting: '但你也有这些不一样的回答',
  qualifying: '所以情况可能没这么简单',
  alternatives: '还有一种可能',
  verification: '想想最近一次',
  method: '方法信息',
  stageEvidence: '主要是这几道回答放在了一起',
  stageBoundary: '这里只能看到一个方向。真正发生了什么，还是要放回你的具体经历里。',
  answerPrefix: '你选：',
  feedbackTitle: '像你吗？',
  feedbackOptions: Object.freeze([
    { value: 'fits', label: '很像' },
    { value: 'partly_fits', label: '有一点像' },
    { value: 'does_not_fit', label: '不太像' },
    { value: 'unsure', label: '说不好' }
  ]),
  feedbackPrompt: '哪里不太对？也可以写一个具体的例子。'
})
