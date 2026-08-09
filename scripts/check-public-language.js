const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const YAML = require('yaml')

const root = path.resolve(__dirname, '..')
const registry = require(path.join(root, 'shared/content/public-language.generated'))
const forbidden = YAML.parse(fs.readFileSync(path.join(root, 'design/public-language-audit/PUBLIC_FORBIDDEN_LANGUAGE.yaml'), 'utf8'))
const snapshotPath = path.join(root, 'tests/fixtures/public-language.snapshot.json')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolute, predicate)
    return predicate(entry.name, absolute) ? [absolute] : []
  })
}

function flattenStrings(value, prefix = '', result = []) {
  if (typeof value === 'string') {
    if (value.trim()) result.push({ key: prefix || 'value', text: value })
    return result
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => flattenStrings(child, `${prefix}[${index}]`, result))
    return result
  }
  if (value && typeof value === 'object') {
    Object.keys(value).sort().forEach(key => flattenStrings(value[key], prefix ? `${prefix}.${key}` : key, result))
  }
  return result
}

function normalizedSnapshotEntry(surface, key, text) {
  return { surface, key, text: String(text).replace(/\s+/g, ' ').trim() }
}

function sourceDigest(name) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'design/public-language-audit', name))).digest('hex')
}

function wxmlStrings(file) {
  const source = fs.readFileSync(file, 'utf8')
  const result = []
  const relative = path.relative(root, file).split(path.sep).join('/')
  const textNodes = source.match(/>([^<>]+)</g) || []
  textNodes.forEach((match, index) => {
    const text = match.slice(1, -1).trim()
    if (text && !/^\{\{.*\}\}$/.test(text)) result.push(normalizedSnapshotEntry(relative, `text.${index}`, text))
  })
  const attributes = source.match(/(?:aria-label|placeholder|title|content|confirm-btn|cancel-btn)="([^"]+)"/g) || []
  attributes.forEach((match, index) => {
    const separator = match.indexOf('=')
    const text = match.slice(separator + 2, -1)
    if (text && !/^\{\{.*\}\}$/.test(text)) result.push(normalizedSnapshotEntry(relative, `attr.${index}`, text))
  })
  return result
}

function jsStrings(file) {
  const source = fs.readFileSync(file, 'utf8')
  const relative = path.relative(root, file).split(path.sep).join('/')
  const result = []
  const pattern = /(['"`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g
  let match
  let index = 0
  while ((match = pattern.exec(source))) {
    const text = match[2]
    if (/[\u4e00-\u9fff]/u.test(text)) {
      result.push(normalizedSnapshotEntry(relative, `literal.${index}`, text))
      index += 1
    }
  }
  return result
}

function collectPublicStrings() {
  const entries = []
  app.pages.forEach(route => {
    const jsonPath = path.join(root, `${route}.json`)
    const wxmlPath = path.join(root, `${route}.wxml`)
    if (fs.existsSync(jsonPath)) {
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      if (json.navigationBarTitleText) entries.push(normalizedSnapshotEntry(`${route}.json`, 'navigationBarTitleText', json.navigationBarTitleText))
    }
    if (fs.existsSync(wxmlPath)) entries.push(...wxmlStrings(wxmlPath))
    const jsPath = path.join(root, `${route}.js`)
    if (fs.existsSync(jsPath)) entries.push(...jsStrings(jsPath))
  })

  const publicModules = [
    'shared/content/ui-copy.js',
    'shared/content/chapter-copy.js',
    'shared/content/claim-copy.js',
    'shared/content/report-copy.js',
    'shared/content/followup-copy.js',
    'shared/content/evidence-copy.js'
  ]
  publicModules.forEach(relative => {
    const exported = require(path.join(root, relative))
    flattenStrings(exported).forEach(entry => entries.push(normalizedSnapshotEntry(relative, entry.key, entry.text)))
  })

  const schema = require(path.join(root, 'shared/assessment/schema.js'))
  schema.ITEMS.forEach(item => entries.push(normalizedSnapshotEntry('shared/assessment/schema.js', `item.${item.id}`, item.publicText || item.text)))
  Object.entries(schema.SCALES).forEach(([scaleId, scale]) => {
    scale.labels.forEach((label, index) => entries.push(normalizedSnapshotEntry('shared/assessment/schema.js', `scale.${scaleId}.${index + 1}`, label)))
    ;(scale.special || []).forEach(option => entries.push(normalizedSnapshotEntry('shared/assessment/schema.js', `scale.${scaleId}.${option.value}`, option.label)))
  })
  schema.CHAPTERS.forEach(chapter => {
    entries.push(normalizedSnapshotEntry('shared/assessment/schema.js', `chapter.${chapter.id}.title`, chapter.publicTitle || chapter.title))
    entries.push(normalizedSnapshotEntry('shared/assessment/schema.js', `chapter.${chapter.id}.instruction`, chapter.publicInstruction || chapter.instruction))
  })

  Object.entries(registry.v2.claimCopyOverrides || {}).forEach(([id, copy]) => {
    flattenStrings(copy).forEach(entry => entries.push(normalizedSnapshotEntry('design/public-language-audit/V2_PUBLIC_COPY_REWRITE.yaml', `claim.${id}.${entry.key}`, entry.text)))
  })
  flattenStrings(registry.ui || {}).forEach(entry => entries.push(normalizedSnapshotEntry('shared/content/public-language.generated.js', `ui.${entry.key}`, entry.text)))
  ;['scaleOverrides', 'chapterTitles', 'itemTextOverrides', 'chapterInsightFallback', 'reportFallback', 'claimDefaults', 'fallbackClaims'].forEach(key => {
    flattenStrings(registry.v2[key] || {}).forEach(entry => entries.push(normalizedSnapshotEntry('shared/content/public-language.generated.js', `v2.${key}.${entry.key}`, entry.text)))
  })
  Object.entries(registry.v2.chapterNarrativePublic || {}).forEach(([chapterId, states]) => {
    flattenStrings(states).forEach(entry => entries.push(normalizedSnapshotEntry('design/public-language-audit/V2_PUBLIC_COPY_REWRITE.yaml', `chapter.${chapterId}.${entry.key}`, entry.text)))
  })

  const v3 = registry.v3
  Object.entries(v3.taskPrompts || {}).forEach(([id, text]) => entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `task.${id}`, text)))
  Object.entries(v3.childPrompts || {}).forEach(([id, text]) => entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `child.${id}`, text)))
  Object.entries(v3.taskOptions || {}).forEach(([id, options]) => Object.entries(options).forEach(([code, text]) => entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `option.${id}.${code}`, text))))
  Object.entries(v3.responseFormatOptions || {}).forEach(([id, options]) => Object.entries(options).forEach(([code, text]) => entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `format.${id}.${code}`, text))))
  Object.entries(v3.taskSpecificOptions || {}).forEach(([id, options]) => Object.entries(options).forEach(([code, text]) => entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `taskOption.${id}.${code}`, text))))
  const runtimeEngine = require(path.join(root, 'shared/assessment-v3-pilot/runtime-engine.js'))
  Object.keys(runtimeEngine.BUNDLE.tasks || {}).forEach(taskId => {
    const task = runtimeEngine.getPublicTask(taskId)
    if (!task) return
    if (task.prompt) entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `runtime.task.${taskId}`, task.prompt))
    const responseItems = task.children && task.children.length ? task.children : [{ itemId: task.taskId, prompt: '', response: task.response }]
    responseItems.forEach(item => {
      if (item.prompt) entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `runtime.child.${item.itemId}`, item.prompt))
      const format = runtimeEngine.resolvePublicFormat(item.response, item.itemId, taskId)
      ;(format && format.options || []).forEach(option => entries.push(normalizedSnapshotEntry('shared/assessment-v3-pilot/runtime-bundle.js', `runtime.option.${item.itemId}.${option.code}`, option.label)))
    })
  })
  flattenStrings(registry.v3.narratives || {}).forEach(entry => entries.push(normalizedSnapshotEntry('shared/content/public-language.generated.js', `v3Narrative.${entry.key}`, entry.text)))
  Object.entries(registry.publicErrors || {}).forEach(([key, text]) => {
    if (typeof text === 'string') entries.push(normalizedSnapshotEntry('shared/content/public-language.generated.js', `error.${key}`, text))
  })
  return entries.filter(entry => entry.text).sort((left, right) => `${left.surface}\u0000${left.key}\u0000${left.text}`.localeCompare(`${right.surface}\u0000${right.key}\u0000${right.text}`))
}

function hardBlockRegex(pattern) {
  try { return new RegExp(pattern, 'iu') } catch (error) { return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu') }
}

function checkHardBlocks(entries) {
  const violations = []
  const patterns = (forbidden.hardBlockExactOrPattern || []).map(hardBlockRegex)
  entries.forEach(entry => patterns.forEach(pattern => {
    if (pattern.test(entry.text)) violations.push(`${entry.surface} [${entry.key}] exposes ${pattern}`)
  }))
  return violations
}

function checkRawErrorDisplays() {
  const violations = []
  const files = app.pages.map(route => path.join(root, `${route}.js`)).concat([
    path.join(root, 'utils/cloud.js'),
    ...walk(path.join(root, 'utils'), name => name.endsWith('.js')).filter(file => !file.endsWith('cloud.js'))
  ])
  files.forEach(file => {
    const source = fs.readFileSync(file, 'utf8')
    const relative = path.relative(root, file).split(path.sep).join('/')
    if (/wx\.show(?:Toast|Modal)\s*\(\s*\{[^}]*?(?:title|content)\s*:\s*[^,}]*error\s*\??\.?(?:errMsg|message)/su.test(source)) violations.push(`${relative} displays raw error text`)
    if (/setData\(\{[^}]*\berror\s*:\s*(?:error\s*&&\s*error\.(?:message|errMsg)|error\.message)/su.test(source)) violations.push(`${relative} stores raw error text`)
  })
  return violations
}

function stringLiteralBodies(source) {
  const literals = []
  const pattern = /(['"`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g
  let match
  while ((match = pattern.exec(source))) literals.push(match[2])
  return literals
}

function checkSourceLanguageLeaks() {
  const violations = []
  const guardedFiles = [
    path.join(root, 'pages/record-claim/index.js'),
    path.join(root, 'shared/assessment/report-engine.js'),
    path.join(root, 'shared/assessment/report-rules.js'),
    path.join(root, 'utils/assessment-v2/chapter-insight-engine.js')
  ]
  guardedFiles.forEach(file => {
    const source = fs.readFileSync(file, 'utf8')
    const relative = path.relative(root, file).split(path.sep).join('/')
    stringLiteralBodies(source).filter(text => /[\u4e00-\u9fff]/u.test(text)).forEach(text => {
      violations.push(`${relative} defines inline user copy: ${text}`)
    })
  })

  const pageFiles = app.pages.map(route => path.join(root, `${route}.js`)).filter(fs.existsSync)
  const recurringLeakPatterns = [
    '保留一点空间',
    '比较一致，可以先这样理解',
    '回答大多指向这个方向',
    '回答不完全一样'
  ]
  pageFiles.forEach(file => {
    const source = fs.readFileSync(file, 'utf8')
    const relative = path.relative(root, file).split(path.sep).join('/')
    recurringLeakPatterns.forEach(pattern => {
      if (source.includes(pattern)) violations.push(`${relative} contains unreviewed public copy: ${pattern}`)
    })
  })
  return violations
}

function main() {
  Object.entries(registry.sourceDigests || {}).forEach(([name, digest]) => assert.equal(sourceDigest(name), digest, `Public language registry is stale for ${name}; run npm run sync:public-language`))
  const entries = collectPublicStrings()
  const hardBlocks = checkHardBlocks(entries)
  const rawErrors = checkRawErrorDisplays()
  const sourceLeaks = checkSourceLanguageLeaks()
  assert.equal(hardBlocks.length, 0, `Public language hard-block findings:\n${hardBlocks.join('\n')}`)
  assert.equal(rawErrors.length, 0, `Raw technical error display findings:\n${rawErrors.join('\n')}`)
  assert.equal(sourceLeaks.length, 0, `Inline public language findings:\n${sourceLeaks.join('\n')}`)
  if (!fs.existsSync(snapshotPath)) throw new Error(`Missing reviewed public-language snapshot: ${path.relative(root, snapshotPath)}; run node scripts/check-public-language.js --write-snapshot after review`)
  const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
  assert.deepEqual(entries, expected, 'Public language snapshot changed; review the new/changed strings and regenerate the fixture')
  console.log(`Public language gate OK: ${entries.length} reviewed strings, 0 hard-blocks, 0 raw error displays`)
}

if (process.argv.includes('--write-snapshot')) {
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
  fs.writeFileSync(snapshotPath, `${JSON.stringify(collectPublicStrings(), null, 2)}\n`, 'utf8')
  console.log(`Public language snapshot written: ${path.relative(root, snapshotPath)}`)
} else if (require.main === module) {
  main()
}

module.exports = { collectPublicStrings, checkHardBlocks, checkRawErrorDisplays, checkSourceLanguageLeaks, snapshotPath }
