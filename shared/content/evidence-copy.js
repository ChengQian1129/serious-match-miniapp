const publicLanguage = require('./public-language.generated')
const chapterInsight = publicLanguage.ui && publicLanguage.ui.chapterInsight || {}
const navigation = publicLanguage.ui && publicLanguage.ui.navigation || {}
const methodGuide = publicLanguage.ui && publicLanguage.ui.methodGuide || {}

module.exports = Object.freeze({
  toggle: chapterInsight.evidenceToggle || navigation.claimEvidence || '',
  supporting: chapterInsight.supporting || chapterInsight.evidenceIntro || '',
  stageEvidence: chapterInsight.evidenceIntro || '',
  contradicting: chapterInsight.contradicting || '',
  qualifying: chapterInsight.qualifying || '',
  answerPrefix: chapterInsight.answerPrefix || '',
  method: methodGuide.detailAction || ''
})
