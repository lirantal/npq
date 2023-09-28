'use strict'

const color = require('kleur')
// eslint-disable-next-line security/detect-child-process
const childProcess = require('child_process')
const semver = require('semver')
const updateNotifier = require('update-notifier')
const pkg = require('../../package.json')

const DEFAULT_PKGMGR = process.env.NPQ_PKG_MGR || 'npm'

const nodeVersion = process.versions.node

updateNotifier({ pkg }).notify()

module.exports.isEnvSupport = function () {
  if (!semver.satisfies(nodeVersion, '>=7.6.0')) {
    return false
  }

  return true
}

module.exports.noSupportError = function (failFast) {
  // eslint-disable-next-line no-console
  console.error(color.red('error:'), 'npq suppressed due to old node version')

  if (failFast === true) {
    process.exit(-1)
  }

  return true
}

module.exports.packageManagerPassthrough = function () {
  const result = childProcess.spawnSync(DEFAULT_PKGMGR, process.argv.slice(2), {
    stdio: 'inherit',
    shell: true
  })

  process.exit(result.status)
}
