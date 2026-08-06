const { saveSource } = require('./utils/storage')
const { initCloud } = require('./utils/cloud')

App({
  onLaunch(options) {
    initCloud()
    const query = options && options.query ? options.query : {}
    const source = query.source || (options && options.scene ? String(options.scene) : '')
    if (source) saveSource(source)
  }
})
