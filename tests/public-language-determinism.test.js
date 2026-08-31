const assert = require('node:assert/strict')
const { collectPublicStrings, comparePublicLanguageEntries } = require('../scripts/check-public-language')

const entries = collectPublicStrings()
assert.deepEqual(entries, entries.slice().sort(comparePublicLanguageEntries))
assert.equal(comparePublicLanguageEntries(
  { surface: 'shared/content/followup-copy.js', key: 'profile.availability', text: '一般什么时候方便联系' },
  { surface: 'shared/content/followup-copy.js', key: 'profile.availabilityPlaceholder', text: '例如：工作日晚 8 点后' }
) < 0, true)
assert.equal(comparePublicLanguageEntries(
  { surface: '页面', key: '甲', text: '中文' },
  { surface: '页面', key: '乙', text: '中文' }
) > 0, true)

console.log('Public language deterministic ordering OK: locale-independent snapshot sort')
