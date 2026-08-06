const { getChapter } = require('./questionnaire-definitions')
const { buildReport } = require('./report-engine')

function buildChapterInsight(chapterId, answers) {
  const chapter = getChapter(chapterId)
  if (!chapter) throw new Error(`未知章节 ${chapterId}`)
  const report = buildReport(answers)
  const sourceSet = new Set(chapter.itemIds)
  const relevant = report.claims.filter(claim => claim.supportingItemIds.some(id => sourceSet.has(id))).slice(0, 2)
  return {
    chapterId,
    title: relevant[0] ? relevant[0].title : '这一章暂时保留了一些未知',
    text: relevant[0] ? relevant[0].text : '你的回答还没有形成足够一致的方向。保留不知道，比勉强给出结论更有价值。',
    boundary: relevant[0] ? relevant[0].boundary : '后续章节会继续核对，不会把缺失当成中间分。',
    claims: relevant
  }
}

module.exports = { buildChapterInsight }
