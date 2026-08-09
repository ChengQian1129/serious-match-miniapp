const { CONTENT_VERSION } = require('./version')

const CHAPTER_COPY = Object.freeze({
  C1: {
    eyebrow: '第一部分',
    title: '你现在想不想谈恋爱',
    body: '先不管年龄、家里和朋友怎么想，也先不管现在有没有具体的人。只看你自己：如果最近真的遇到一个不错的人，你愿不愿意认真认识他？',
    hint: '按你现在的状态回答。'
  },
  C2: {
    eyebrow: '第二部分',
    title: '你现在有没有时间和精力',
    body: '想谈恋爱是一回事，真有时间和精力持续认识一个人是另一回事。这里主要问你最近的生活状态。',
    hint: '按最近一个月的真实情况回答。'
  },
  C3: {
    eyebrow: '第三部分',
    title: '对方态度变了，你通常会怎样',
    body: '想一个你真的在意过的人。如果他突然回得慢了、变冷了，或者一直不把关系说清楚，你通常会怎么反应？',
    hint: '没有类似经历的题，可以选“暂时说不好”。'
  },
  C4: {
    eyebrow: '第四部分',
    title: '关系越来越亲近以后',
    body: '两个人越来越亲近以后，有些人会觉得很舒服，有些时候也会想多留一点自己的时间。这里问的是你真实相处时的感受。',
    hint: '按你实际会怎样回答，不按你觉得自己应该怎样。'
  },
  C5: {
    eyebrow: '第五部分',
    title: '你希望对方怎么支持你',
    body: '你难受的时候希望对方怎么做？轮到对方难受时，你平时又会怎么做？这里把两件事分开问。',
    hint: '按你真实需要和真实做法回答。'
  },
  C6: {
    eyebrow: '最后一部分',
    title: '吵架以后，你通常怎么处理',
    body: '两个人都很生气的时候，你会继续谈、先停一会儿，还是先躲开？冷静以后，你还会不会回来把事情说完？',
    hint: '按过去比较常见的情况回答。'
  }
})

function getChapterCopy(chapterId) {
  return Object.assign({ contentVersion: CONTENT_VERSION }, CHAPTER_COPY[chapterId] || {})
}

module.exports = { CONTENT_VERSION, CHAPTER_COPY, getChapterCopy }
