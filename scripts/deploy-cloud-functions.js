const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.join(__dirname, '..')
const configPath = path.join(root, 'config', 'cloud.js')
if (!fs.existsSync(configPath)) {
  console.error('Missing config/cloud.js. Copy config/cloud.example.js and fill the local environment ID first.')
  process.exit(1)
}

const config = require(configPath)
if (!config.envId || !/^cloud[0-9a-z-]+$/i.test(config.envId)) {
  console.error('config/cloud.js must contain a valid envId.')
  process.exit(1)
}

const cli = process.env.WECHAT_DEVTOOLS_CLI || 'F:\\Tencent\\WeChatDevTools\\cli.bat'
if (!fs.existsSync(cli)) {
  console.error(`WeChat DevTools CLI not found: ${cli}`)
  console.error('Set WECHAT_DEVTOOLS_CLI to the absolute path of cli.bat.')
  process.exit(1)
}

const names = ['assessmentService', 'participantService', 'interviewOps', 'datingProfile']
const args = ['cloud', 'functions', 'deploy', '--env', config.envId, '--names', ...names, '--project', root, '--remote-npm-install']
console.log(`Deploying ${names.length} cloud functions to the configured local environment...`)
const result = spawnSync(cli, args, { cwd: root, stdio: ['inherit', 'pipe', 'pipe'], encoding: 'utf8', shell: true, windowsHide: true })
const output = `${result.stdout || ''}${result.stderr || ''}`
process.stdout.write(output)
if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
if (/需要重新登录|please\s+(?:sign|log)\s+in|re-?login/i.test(output)) {
  console.error('WeChat DevTools is signed out. Log in to DevTools, reopen the project, then rerun npm run deploy:cloud.')
  process.exit(1)
}
if (Number(result.status) !== 0 || /fail to deploy|\|\s+false\s+\||× deploy cloudfunctions/i.test(output)) {
  console.error('Cloud function deployment did not complete successfully.')
  process.exit(1)
}
process.exit(0)
