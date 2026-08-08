const { CONTENT_VERSION } = require('./version')

const CHAPTER_COPY = Object.freeze({
  C1: { eyebrow: '第一组', title: '你现在真的想开始吗？', body: '先不管年龄、家里、朋友，也先不管有没有具体的人。只看你自己：如果最近真的遇到一个不错的人，你愿不愿意让一段关系进入现在的生活？', hint: '按你现在和未来一个月的状态答。', lead: '有件事挺明显。', reflection: '如果现在完全没人催你，你还会想认真认识一个人吗？' },
  C2: { eyebrow: '第二组', title: '生活里装得下一段关系吗？', body: '想开始是一回事。真的有时间、有精力持续认识一个人，是另一回事。这一组只看你最近真实能拿出来多少空间。', hint: '想想未来一个月真实可用的时间和情绪空间。', lead: '这里有个差别值得分开看。', reflection: '最近哪一段时间，最可能真正留给另一个人？' },
  C3: { eyebrow: '第三组', title: '对方一变，你会怎样？', body: '想一个你真的在意过的人。可能是恋爱、暧昧，也可能是一段没有正式开始但你很上心的关系。如果对方突然变慢、变冷、说不清，真实的你通常会怎么反应？', hint: '经验不够的题，可以选“暂时说不好”。', lead: '关系一变，你的注意力可能会先跟着变。', reflection: '最近一次对方变得不一样时，你先注意到的是什么？' },
  C4: { eyebrow: '第四组', title: '真正靠近以后呢？', body: '有的人最怕失去。也有人真正靠得很近以后，反而会想退一点。这里不分好坏，只看关系越来越亲近时，你通常舒不舒服。', hint: '按真实相处，不按理想中的自己答。', lead: '靠近和想保留一点自己，可以同时存在。', reflection: '什么时候的亲近会让你觉得舒服，什么时候会让你想退一点？' },
  C5: { eyebrow: '第五组', title: '你想被怎么对待？', body: '你希望别人怎么对你，和你平时能不能这样对别人，是两回事。这一组把需要和能够给出的支持分开看。', hint: '先回答你真实需要什么，再看你通常能做到什么。', lead: '你要什么，和你能给什么，不一定完全一样。', reflection: '你难受时最希望对方先做什么？轮到对方难受时，你会先做什么？' },
  C6: { eyebrow: '最后一组', title: '吵完以后，怎么回来？', body: '最后看冲突。不是判断谁脾气好、谁脾气差，而是两个人都上头以后，能不能停下来，又能不能重新把那件事拿回来谈。', hint: '按过去通常能做到的程度回答。', lead: '暂停本身不是结局，回来才是。', reflection: '最近一次冲突之后，谁先把那件事重新拿回来谈？' }
})

function getChapterCopy(chapterId) { return Object.assign({ contentVersion: CONTENT_VERSION }, CHAPTER_COPY[chapterId] || {}) }

module.exports = { CONTENT_VERSION, CHAPTER_COPY, getChapterCopy }
