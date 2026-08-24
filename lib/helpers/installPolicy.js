'use strict'

function getInstallAction({
  countErrors = 0,
  countWarnings = 0,
  isInteractive = false,
  disableAutoContinue = false,
  allowNonInteractiveInstall = false
} = {}) {
  if (countErrors > 0) {
    return isInteractive ? 'prompt' : 'reject'
  }

  if (countWarnings > 0) {
    if (isInteractive) {
      return disableAutoContinue ? 'prompt' : 'countdown'
    }

    return !disableAutoContinue && allowNonInteractiveInstall ? 'install' : 'reject'
  }

  return 'install'
}

function createNonInteractiveInstallError() {
  const error = new Error(
    'Installation blocked: findings require an interactive terminal or an explicit non-interactive install opt-in.'
  )
  error.code = 'NON_INTERACTIVE_INSTALL'
  error.exitCode = 1
  return error
}

module.exports = {
  getInstallAction,
  createNonInteractiveInstallError
}
