'use strict'

const { styleText } = require('node:util')

// eslint-disable-next-line security/detect-child-process
const childProcess = require('child_process')
const semver = require('semver')

const DEFAULT_PKGMGR = process.env.NPQ_PKG_MGR || 'npm'

const nodeVersion = process.versions.node

function isEnvSupport() {
  if (!semver.satisfies(nodeVersion, '>=20.13.0')) {
    return false
  }

  return true
}

function noSupportError(failFast) {
  if (isInteractiveTerminal()) {
    // eslint-disable-next-line no-console
    console.error(styleText('red', 'error:'), 'npq suppressed due to old node version')
  } else {
    // eslint-disable-next-line no-console
    console.error('error: npq suppressed due to old node version')
  }

  if (failFast === true) {
    process.exit(-1)
  }

  return true
}

function packageManagerPassthrough() {
  const result = childProcess.spawnSync(DEFAULT_PKGMGR, process.argv.slice(2), {
    stdio: 'inherit',
    shell: true
  })

  process.exit(result.status)
}

/**
 * Check if we're running in an interactive terminal environment
 * @returns {boolean} True if interactive, false if in CI/build environment
 */
function isInteractiveTerminal() {
  // Check common CI environment variables
  const ciEnvVars = [
    'CI',
    'CONTINUOUS_INTEGRATION',
    'BUILD_NUMBER',
    'RUN_ID',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'TRAVIS',
    'CIRCLECI',
    'JENKINS_URL',
    'TEAMCITY_VERSION',
    'TF_BUILD'
  ]

  // If any CI environment variable is set, we're likely in a CI environment
  const isCI = ciEnvVars.some((envVar) => process.env[envVar])

  // Check if stdout is a TTY (terminal)
  const isTTY = process.stdout.isTTY

  // We're interactive if we're in a TTY and not in CI
  return isTTY && !isCI
}

module.exports = {
  isEnvSupport,
  noSupportError,
  packageManagerPassthrough,
  isInteractiveTerminal
}
