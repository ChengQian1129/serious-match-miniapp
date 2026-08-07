const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
;['pages/compare/index', 'pages/profile-preview/index', 'pages/contact/index', 'pages/profile/index'].forEach(route => assert.equal(app.pages.includes(route), false, route + ' must not be public'))
const banned = /匹配池|候选人|适合对象|关系对照|邀请朋友|匿名介绍|希望认识|出现合适人选|认真匹配|匿名档案/
app.pages.map(page => path.join(root, page + '.wxml')).forEach(file => assert.equal(banned.test(fs.readFileSync(file, 'utf8')), false, 'banned copy: ' + path.relative(root, file)))
console.log('Public boundary static check OK')
