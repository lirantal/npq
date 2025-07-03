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
const spinner = new Spinner({ text: 'Initiating...' })
spinner.start()

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
    spinner.stop()

    const results = reportResults(marshallResults)
    if (
      results &&
      Object.hasOwn(results, 'countErrors') &&
      Object.hasOwn(results, 'countWarnings')
    ) {
      const { countErrors, countWarnings } = results
      const isErrors = countErrors > 0 || countWarnings > 0

      if (isErrors) {
        console.log()
        console.log('Packages with issues found:')

        console.log(results.resultsForPrettyPrint)
        console.log(results.summaryForPrettyPrint)
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
      // eslint-disable-next-line no-console
      console.log()
      return cliPrompt.prompt({
        name: 'install',
        message: 'Continue install ?',
        default: false
      })
    } else {
      if (result && result.countWarnings > 0) {
        // eslint-disable-next-line no-console
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
    if (status && status.hasOwnProperty('install') && status.install === true) {
      pkgMgr.process(cliArgs.packageManager)
    }
  })
  .catch((error) => {
    CliParser.exit({
      errorCode: error.code || -1,
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
