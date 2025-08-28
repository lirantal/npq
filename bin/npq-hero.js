#!/usr/bin/env node
'use strict'

// Require minimum node version or bail out
const cliSupport = require('../lib/helpers/cliSupportHandler')
cliSupport.isEnvSupport() || (cliSupport.noSupportError() && cliSupport.packageManagerPassthrough())

const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')
const { CliParser } = require('../lib/cli')
const cliPrompt = require('../lib/helpers/cliPrompt.js')
const { reportResults } = require('../lib/helpers/reportResults')
const { Spinner } = require('../lib/helpers/cliSpinner')
const { promiseThrottleHelper } = require('../lib/helpers/promiseThrottler')

const PACKAGE_MANAGER_TOOL = process.env.NPQ_PKG_MGR

const cliArgs = CliParser.parseArgsMinimal()

const silentModeNoPackages = !cliArgs || !cliArgs.packages || cliArgs.packages.length === 0

const isInteractive = cliSupport.isInteractiveTerminal() && !silentModeNoPackages
const spinner = isInteractive ? new Spinner({ text: 'Initiating...' }) : null

if (spinner) {
  spinner.start()
}

const marshall = new Marshall({
  pkgs: cliArgs.packages,
  progressManager: spinner,
  promiseThrottleHelper
})

marshall
  .process()
  .then((marshallResults) => {
    if (spinner) {
      spinner.stop()
    }

    const results = reportResults(marshallResults)
    if (
      results &&
      Object.hasOwn(results, 'countErrors') &&
      Object.hasOwn(results, 'countWarnings')
    ) {
      const { countErrors, countWarnings, useRichFormatting } = results
      const isErrors = countErrors > 0 || countWarnings > 0

      if (isErrors) {
        console.log()
        console.log('Packages with issues found:')

        if (useRichFormatting) {
          console.log(results.resultsForPrettyPrint)
          console.log(results.summaryForPrettyPrint)
        } else {
          console.log(results.resultsForPlainTextPrint)
          console.log(results.summaryForPlainTextPrint)
        }
      }

      return {
        anyIssues: isErrors,
        countErrors,
        countWarnings
      }
    }
    return undefined
  })
  .then((result) => {
    if (result && result.countErrors > 0) {
      console.log()
      return cliPrompt.prompt({
        name: 'install',
        message: 'Continue install ?',
        default: false
      })
    } else {
      if (result && result.countWarnings > 0) {
        console.log()
        return cliPrompt.autoContinue({
          name: 'install',
          message: 'Auto-continue with install in... ',
          timeInSeconds: 15
        })
      }
    }

    return { install: true }
  })
  .then((status) => {
    if (
      status &&
      Object.prototype.hasOwnProperty.call(status, 'install') &&
      status.install === true
    ) {
      pkgMgr.process(PACKAGE_MANAGER_TOOL)
    }
  })
  .catch((error) => {
    // Ensure errorCode is always a number
    let errorCode = -1
    if (typeof error.code === 'number') {
      errorCode = error.code
    } else if (error.code === 'ABORT_ERR') {
      errorCode = 1
    } else if (error.code === 'USER_ABORT') {
      errorCode = error.exitCode || 1
    }

    CliParser.exit({
      errorCode,
      message: error.message || 'An error occurred',
      spinner
    })
  })
