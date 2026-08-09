const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const targets = app.pages.flatMap(route => [
  path.join(root, `${route}.wxml`),
  path.join(root, `${route}.json`)
]).concat(
  fs.readdirSync(path.join(root, 'shared', 'content'))
    .filter(file => file.endsWith('.js') && file !== 'public-language.generated.js')
    .map(file => path.join(root, 'shared', 'content', file))
)

const forbidden = [
  'USER_SKIPPED',
  'NOT_SHOWN_BY_DESIGN',
  'TECHNICAL_MISSING',
  'constructId',
  'measurement confidence',
  'validation-only',
  'planned missing',
  '研究表单 A',
  '研究表单 B',
  '研究表单 C',
  '研究 Pilot',
  '像你吗？',
  '很像',
  '有一点像',
  '不太像',
  'chapter_insight_feedback',
  '阶段核对'
]

const forbiddenPatterns = [
  /\bC[1-6]\b/,
  /\bP0(?:\.5)?\b/,
  /\bP1\b/
]

const violations = []
targets.forEach(file => {
  const source = fs.readFileSync(file, 'utf8')
  forbidden.forEach(token => {
    if (source.includes(token)) violations.push(`${path.relative(root, file)} exposes ${token}`)
  })
  if (file.endsWith('.wxml') || file.endsWith('.json')) {
    forbiddenPatterns.forEach(pattern => {
      if (pattern.test(source)) violations.push(`${path.relative(root, file)} exposes ${pattern}`)
    })
  }
})

if (violations.length) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Public copy check OK: ${targets.length} user-facing files scanned`)
}
