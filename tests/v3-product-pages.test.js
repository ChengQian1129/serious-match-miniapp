const assert = require('node:assert/strict')

let lastNavigation = null
global.wx = {
  navigateTo(options) { lastNavigation = { method: 'navigateTo', url: options.url }; if (options.success) options.success({}) },
  redirectTo(options) { lastNavigation = { method: 'redirectTo', url: options.url }; if (options.success) options.success({}) },
  reLaunch(options) { lastNavigation = { method: 'reLaunch', url: options.url }; if (options.success) options.success({}) },
  navigateBack(options = {}) { lastNavigation = { method: 'navigateBack' }; if (options.success) options.success({}) }
}

function loadPage(relative) {
  let definition
  global.Page = value => { definition = value }
  const absolute = require.resolve(relative)
  delete require.cache[absolute]
  require(absolute)
  assert.ok(definition, `${relative} did not register a page`)
  definition.setData = function setData(update) { this.data = Object.assign({}, this.data, update) }
  return definition
}

const preview = loadPage('../pages/v3-product-preview/index.js')
preview.onLoad({})
assert.equal(preview.data.personas.length, 12)
preview.startChapter()
assert.match(lastNavigation.url, /pages\/v3-checkpoint\/index\?persona=/)

const checkpoint = loadPage('../pages/v3-checkpoint/index.js')
checkpoint.onLoad({ persona: 'ready_self', chapter: 'C1' })
assert.equal(checkpoint.data.chapter.id, 'C1')
assert.equal(checkpoint.data.chapter.dimensionCards.length, 2)
checkpoint.openEvidence({ currentTarget: { dataset: { dimensionId: checkpoint.data.chapter.dimensionCards[0].id } } })
assert.match(lastNavigation.url, /pages\/v3-result-evidence\/index\?persona=ready_self&dimension=/)

const result = loadPage('../pages/v3-result/index.js')
result.onLoad({ persona: 'ready_self' })
assert.equal(result.data.chapters.length, 6)
assert.equal(result.data.chapters.reduce((total, chapter) => total + chapter.dimensionCards.length, 0), 14)
result.openEvidence({ currentTarget: { dataset: { dimensionId: result.data.chapters[0].dimensionCards[0].id } } })
assert.match(lastNavigation.url, /pages\/v3-result-evidence\/index\?persona=ready_self&dimension=/)

const evidence = loadPage('../pages/v3-result-evidence/index.js')
evidence.onLoad({ persona: 'ready_self', dimension: 'relationship_readiness' })
assert.ok(evidence.data.finding.evidence.length)

console.log('V3 product pages OK: preview, checkpoint, result and evidence routes are walkable')
