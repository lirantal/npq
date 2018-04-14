'use strict'

const chalk = require('chalk')
const childProcess = require('child_process')
const semver = require('semver')
const DEFAULT_PKGMGR = process.env.NPQ_PKG_MGR || 'npm'

const nodeVersion = process.versions.node

module.exports.isEnvSupport = function () {
  if (!semver.satisfies(nodeVersion, '>=7.6.0')) {
    return false
  }

  return true
}

module.exports.noSupportError = function () {
  console.error(chalk.red('error:'), 'npq suppressed due to old node version')
  return true
}

module.exports.packageManagerPassthrough = function () {
  const result = childProcess.spawnSync(DEFAULT_PKGMGR, process.argv.slice(2), {
    stdio: 'inherit',
    shell: true
  })

  process.exit(result.status)
}
