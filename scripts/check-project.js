const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')

function walk(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolutePath, extension)
    return entry.name.endsWith(extension) ? [absolutePath] : []
  })
}

function packedFiles(directory, relativeDirectory, ignoredFolders, ignoredFiles) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    if (ignoredFiles.has(relativePath)) return []
    if ([...ignoredFolders].some(folder => relativePath === folder || relativePath.startsWith(`${folder}/`))) return []
    const absolutePath = path.join(directory, entry.name)
    return entry.isDirectory()
      ? packedFiles(absolutePath, relativePath, ignoredFolders, ignoredFiles)
      : [absolutePath]
  })
}

function referencedTDesignFolders(pageJsonFiles) {
  const tdesignRoot = path.join(projectRoot, 'miniprogram_npm', 'tdesign-miniprogram')
  const folders = new Set(['common', 'mixins', 'locale', 'config-provider'])
  const queue = []
  const enqueue = value => {
    if (!value || !value.includes('tdesign-miniprogram/')) return
    const relative = value.slice(value.indexOf('tdesign-miniprogram/') + 'tdesign-miniprogram/'.length)
    queue.push(path.join(tdesignRoot, relative))
  }
  pageJsonFiles.forEach(file => Object.values(JSON.parse(fs.readFileSync(file, 'utf8')).usingComponents || {}).forEach(enqueue))
  const visited = new Set()
  while (queue.length) {
    const componentBase = path.normalize(queue.shift())
    if (visited.has(componentBase)) continue
    visited.add(componentBase)
    const relative = path.relative(tdesignRoot, componentBase)
    if (!relative.startsWith('..')) folders.add(relative.split(path.sep)[0])
    const jsonFile = `${componentBase}.json`
    if (!fs.existsSync(jsonFile)) continue
    const config = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
    Object.values(config.usingComponents || {}).forEach(value => {
      if (value.startsWith('.')) queue.push(path.resolve(path.dirname(jsonFile), value))
      else enqueue(value)
    })
  }
  return folders
}

const businessJs = [path.join(projectRoot, 'app.js')]
  .concat(walk(path.join(projectRoot, 'pages'), '.js'))
  .concat(walk(path.join(projectRoot, 'utils'), '.js'))

businessJs.forEach(file => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }))
const cloudJs = walk(path.join(projectRoot, 'cloudfunctions'), '.js')
cloudJs.forEach(file => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }))

const projectJson = [
  'app.json',
  'project.config.json',
  'project.private.config.json',
  'sitemap.json'
].map(file => path.join(projectRoot, file)).concat(walk(path.join(projectRoot, 'pages'), '.json'))

projectJson.forEach(file => JSON.parse(fs.readFileSync(file, 'utf8')))

const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.config.json'), 'utf8'))
const packIgnore = projectConfig.packOptions && projectConfig.packOptions.ignore || []
const ignoredFolders = new Set(packIgnore.filter(item => item.type === 'folder').map(item => item.value.replace(/\\/g, '/')))
if (projectConfig.cloudfunctionRoot) ignoredFolders.add(projectConfig.cloudfunctionRoot.replace(/[\\/]$/, '').replace(/\\/g, '/'))
const ignoredFiles = new Set(packIgnore.filter(item => item.type === 'file').map(item => item.value.replace(/\\/g, '/')))
const pageJsonFiles = walk(path.join(projectRoot, 'pages'), '.json')
const tdesignFolders = referencedTDesignFolders(pageJsonFiles)
const packed = packedFiles(projectRoot, '', ignoredFolders, ignoredFiles).filter(file => {
  const relative = path.relative(projectRoot, file).split(path.sep).join('/')
  if (!relative.startsWith('miniprogram_npm/tdesign-miniprogram/')) return true
  return tdesignFolders.has(relative.split('/')[2])
})
const packageBytes = packed.reduce((total, file) => total + fs.statSync(file).size, 0)
const packageGuardBytes = 1.8 * 1024 * 1024
assert.ok(packageBytes <= packageGuardBytes, `Main package estimate ${Math.ceil(packageBytes / 1024)} KB exceeds the 1.8 MB guard`)

const voidTags = new Set(['input', 'image'])
const wxmlFiles = walk(path.join(projectRoot, 'pages'), '.wxml')
wxmlFiles.forEach(file => {
  const stack = []
  const source = fs.readFileSync(file, 'utf8')
  const tags = source.match(/<\/?[a-z][^>]*>/gi) || []

  tags.forEach(tag => {
    const name = tag.match(/^<\/?([\w-]+)/)[1]
    if (tag.startsWith('</')) {
      assert.equal(stack.pop(), name, `Mismatched WXML tag ${tag} in ${path.relative(projectRoot, file)}`)
      return
    }
    if (!tag.endsWith('/>') && !voidTags.has(name)) stack.push(name)
  })

  assert.deepEqual(stack, [], `Unclosed WXML tag in ${path.relative(projectRoot, file)}`)
})

const appConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'))
const registeredPages = new Set(appConfig.pages)
let bindingCount = 0

global.Page = definition => {
  global.__checkedPageDefinition = definition
}

appConfig.pages.forEach(pagePath => {
  const pageBase = path.join(projectRoot, pagePath)
  const jsFile = `${pageBase}.js`
  const wxmlFile = `${pageBase}.wxml`
  const jsonFile = `${pageBase}.json`
  assert.ok(fs.existsSync(jsFile), `Missing page script: ${pagePath}.js`)
  assert.ok(fs.existsSync(wxmlFile), `Missing page template: ${pagePath}.wxml`)
  assert.ok(fs.existsSync(jsonFile), `Missing page config: ${pagePath}.json`)

  global.__checkedPageDefinition = null
  delete require.cache[require.resolve(jsFile)]
  require(jsFile)
  const definition = global.__checkedPageDefinition
  assert.ok(definition, `Page was not registered: ${pagePath}.js`)

  const source = fs.readFileSync(wxmlFile, 'utf8')
  const eventPattern = /\b(?:bind|catch)(?::?[a-z][\w-]*)="([A-Za-z_$][\w$]*)"/g
  for (const match of source.matchAll(eventPattern)) {
    const handler = match[1]
    bindingCount += 1
    assert.equal(typeof definition[handler], 'function', `Missing handler ${handler} in ${pagePath}.js`)
  }
})

delete global.Page
delete global.__checkedPageDefinition

let routeCount = 0
businessJs.forEach(file => {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/\/(pages\/[a-z0-9-]+\/index)/gi)) {
    routeCount += 1
    assert.ok(registeredPages.has(match[1]), `Unregistered route /${match[1]} in ${path.relative(projectRoot, file)}`)
  }
})

console.log(`Static checks OK: ${businessJs.length} client JS, ${cloudJs.length} cloud JS, ${projectJson.length} JSON, ${wxmlFiles.length} WXML, ${bindingCount} bindings, ${routeCount} routes`)
console.log(`Referenced package estimate: ${Math.ceil(packageBytes / 1024)} KB / 1844 KB guard (${[...tdesignFolders].sort().join(', ')})`)
