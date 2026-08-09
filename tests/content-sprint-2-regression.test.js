const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const { ITEMS, CHAPTERS, INSTRUMENT_VERSION } = require('../shared/assessment/schema')
const { rules, REPORT_RULE_VERSION } = require('../shared/assessment/report-rules')
const { CONTENT_VERSION, REPORT_COPY_VERSION } = require('../shared/content/version')
const glossary = require('../shared/content/glossary')
const reportCopy = require('../shared/content/report-copy')
const uiCopy = require('../shared/content/ui-copy')

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8') }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') }

const chapterByItem = {}
CHAPTERS.forEach(chapter => chapter.itemIds.forEach(itemId => { chapterByItem[itemId] = chapter.id }))
const instrumentFields = ITEMS.map(item => ({ id: item.id, chapter: chapterByItem[item.id], scale: item.scaleId, reverseScored: Boolean(item.reverseScored), dimension: item.constructId }))
assert.equal(ITEMS.length, 48)
assert.equal(INSTRUMENT_VERSION, '2.1.1-pilot')
assert.equal(hash(instrumentFields), '72a5fc23c133442bb6645693d131a6d57d7b1108d6a6d9179c1df63b617343e5')

const ruleFields = rules.map(({ id, section, conditions, supportSelectors, contradictionSelectors, qualificationSelectors }) => ({ id, section, conditions, supportSelectors, contradictionSelectors, qualificationSelectors }))
assert.equal(REPORT_RULE_VERSION, 'serious-match-report-rules-2.1.0')
assert.equal(rules.length, 19)
assert.equal(hash(ruleFields), '8db2fbc5f0d13bb9c706aed90351ba776513ac249076b240fcfbea4068b20955')

assert.equal(CONTENT_VERSION, 'relationship-manual-copy-1.2.0')
assert.equal(REPORT_COPY_VERSION, 'relationship-manual-report-copy-1.2.0')
assert.equal(reportCopy.sections.some(section => section.id === 'observation'), false)

const welcomeJs = read('pages/welcome/index.js')
const welcomeWxml = read('pages/welcome/index.wxml')
const reportJs = read('pages/questionnaire-result/index.js')
const reportWxml = read('pages/questionnaire-result/index.wxml')
const followupFiles = [
  'pages/followup-intro/index.js',
  'pages/followup-settings/index.js',
  'pages/followup-profile/index.js'
]
assert.equal(welcomeJs.includes('currentSlide'), false)
assert.equal(welcomeJs.includes('welcome_slide'), false)
assert.equal(welcomeWxml.includes('slideDots'), false)
assert.equal(uiCopy.welcome.title.replace(/\n/g, ''), '先看看自己谈恋爱时会怎么想、怎么做。')
assert.equal(welcomeWxml.includes('{{welcome.title}}'), true)
assert.equal((welcomeWxml.match(/class="welcome-primary"/g) || []).length, 1)
assert.equal(reportJs.includes('topFindings'), true)
assert.equal(reportJs.includes('chapterResults'), true)
assert.equal(reportJs.includes('confirmationLabels'), false)
assert.equal(reportWxml.includes('report.subtitle'), false)
assert.equal(reportWxml.includes('reportRuleVersion'), false)
assert.equal(reportWxml.includes('confidence'), false)
assert.equal(reportWxml.includes('confirmationLabel'), false)
followupFiles.forEach(file => assert.equal(read(file).includes('followup-copy'), true, `${file} must use followup-copy`))
assert.equal(read('pages/followup-intro/index.wxml').includes('不参加，也不会影响你的报告'), false)
assert.equal(read('shared/content/followup-copy.js').includes('不参加也不会影响你看结果'), true)

const app = JSON.parse(read('app.json'))
const publicPages = app.pages.map(route => read(route + '.wxml')).join('\n')
const publicContent = [
  read('shared/content/ui-copy.js'),
  read('shared/content/chapter-copy.js'),
  read('shared/content/claim-copy.js'),
  read('shared/content/report-copy.js'),
  read('shared/content/followup-copy.js'),
  read('shared/content/evidence-copy.js')
].join('\n')
glossary.forbiddenPublicPhrases.forEach(phrase => {
  assert.equal(publicPages.includes(phrase), false, `forbidden page copy: ${phrase}`)
  assert.equal(publicContent.includes(phrase), false, `forbidden content copy: ${phrase}`)
})

console.log('Content Sprint 2 regression OK: instrument and rules unchanged; copy boundary locked')
