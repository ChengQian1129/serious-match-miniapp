const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { services, expectedFiles } = require('./sync-cloud-services')

const root = path.resolve(__dirname, '..')
Object.entries(services).forEach(([name, actions]) => {
  const targetDir = path.join(root, 'cloudfunctions', name)
  expectedFiles(name, actions).forEach((expected, file) => {
    const target = path.join(targetDir, file)
    assert.ok(fs.existsSync(target), `${name}/${file} is missing; run npm run sync:cloud-services`)
    assert.equal(fs.readFileSync(target, 'utf8'), expected, `${name}/${file} is stale; run npm run sync:cloud-services`)
  })
})
console.log('Cloud service split OK: assessment, participant, and interview actions are isolated')
