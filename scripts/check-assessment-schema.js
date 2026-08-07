const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'shared/assessment/schema.js'), 'utf8')
const digest = crypto.createHash('sha256').update(source).digest('hex')
;[
  'utils/assessment-v2/generated/questionnaire-definitions.js',
  'cloudfunctions/datingProfile/assessment-v2-questionnaire-definitions.generated.js'
].forEach(file => assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), source, file + ' is stale; run npm run sync:assessment'))
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'shared/assessment/schema.manifest.json'), 'utf8'))
assert.equal(manifest.sha256, digest)
assert.equal(manifest.instrumentVersion, '2.1.0-pilot')
console.log('Assessment schema check OK:', digest)
