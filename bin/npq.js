#!/usr/bin/env node
'use strict'

const util = require('node:util')

// Require minimum node version or bail out
const cliSupport = require('../lib/helpers/cliSupportHandler')
cliSupport.isEnvSupport() || cliSupport.noSupportError(true)

const { getProjectPackages } = require('../lib/helpers/sourcePackages')
const { CliParser } = require('../lib/cli')
const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')
const cliPrompt = require('../lib/helpers/cliPrompt.js')
const { reportResults } = require('../lib/helpers/reportResults')
const { Spinner } = require('../lib/helpers/cliSpinner')
const { promiseThrottleHelper } = require('../lib/helpers/promiseThrottler')

const debug = util.debuglog('npq')

const cliArgs = CliParser.parseArgsFull()
const isInteractive = cliSupport.isInteractiveTerminal() && !cliArgs.plain
const spinner = isInteractive ? new Spinner({ text: 'Initiating...' }) : null

if (spinner) {
  spinner.start()
}

Promise.resolve()
  .then(() => {
    if (cliArgs.packages.length === 0) {
      debug('\nNo packages specified, using project packages from package.json')
      return getProjectPackages()
    }

    return cliArgs.packages
  })
  .then((packages) => {
    if (packages.error) {
      console.log()
      CliParser.exit({
        errorCode: packages.error.code || -1,
        message: packages.message,
        spinner
      })
    }

    const marshall = new Marshall({
      pkgs: packages,
      progressManager: spinner,
      promiseThrottleHelper
    })

    return marshall.process()
  })
  .then((marshallResults) => {
    if (spinner) {
      spinner.stop()
    }

    const results = reportResults(marshallResults, { plain: cliArgs.plain })
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
    if (cliArgs.dryRun) {
      CliParser.exit({
        errorCode: 0,
        spinner
      })
    }

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
        // Check if auto-continue is disabled via CLI flag or environment variable
        if (cliArgs.disableAutoContinue) {
          return cliPrompt.prompt({
            name: 'install',
            message: 'Continue install ?',
            default: false
          })
        }
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
      pkgMgr.process(cliArgs.packageManager)
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

// attach event handler for CTRL+C
process.on('SIGINT', () => {
  CliParser.exit({
    errorCode: 0,
    spinner
  })
})
