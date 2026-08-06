const fs = require('fs')
const path = require('path')

const replacements = [
  {
    file: 'picker/picker.wxss',
    before: '.t-picker__main{position:relative;display:flex;justify-content:center;padding-left:64rpx;padding-right:64rpx;}',
    after: '.t-picker__main{position:relative;display:flex;justify-content:stretch;padding-left:40rpx;padding-right:40rpx;}'
  },
  {
    file: 'picker-item/picker-item.wxss',
    before: '.t-picker-item__item{display:flex;justify-content:center;align-items:center;color:',
    after: '.t-picker-item__item{display:flex;justify-content:flex-start;align-items:center;padding-left:24rpx;padding-right:24rpx;color:'
  }
]

const roots = [
  path.join(__dirname, '..', 'node_modules', 'tdesign-miniprogram', 'miniprogram_dist'),
  path.join(__dirname, '..', 'miniprogram_npm', 'tdesign-miniprogram')
]

let patched = 0

for (const root of roots) {
  for (const replacement of replacements) {
    const target = path.join(root, replacement.file)
    if (!fs.existsSync(target)) continue

    const source = fs.readFileSync(target, 'utf8')
    if (source.includes(replacement.after)) continue
    if (!source.includes(replacement.before)) {
      throw new Error(`Unsupported TDesign picker stylesheet: ${target}`)
    }

    fs.writeFileSync(target, source.replace(replacement.before, replacement.after), 'utf8')
    patched += 1
  }
}

console.log(`TDesign picker patch ready (${patched} file${patched === 1 ? '' : 's'} updated)`)

