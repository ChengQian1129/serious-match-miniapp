const assert = require('node:assert/strict')

let calls = 0
global.wx = {
  navigateTo(options) { calls += 1; options.success({}) },
  redirectTo(options) { calls += 1; options.fail(new Error('failed')) }
}

const { navigateOnce, resetNavigation } = require('../utils/navigation')
const page = {}
assert.equal(navigateOnce(page, 'navigateTo', { url: '/first' }), true)
assert.equal(navigateOnce(page, 'navigateTo', { url: '/duplicate' }), false)
assert.equal(calls, 1)
resetNavigation(page)
assert.equal(navigateOnce(page, 'navigateTo', { url: '/after-show' }), true)
assert.equal(calls, 2)

resetNavigation(page)
assert.equal(navigateOnce(page, 'redirectTo', { url: '/failure' }), true)
assert.equal(page._isRouting, false)

console.log('Navigation OK: duplicate routes stay locked until next onShow')
