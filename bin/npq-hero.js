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
const RegistryConfig = require('../lib/helpers/registryConfig')
const RegistryClient = require('../lib/helpers/registryClient')

const PACKAGE_MANAGER_TOOL = process.env.NPQ_PKG_MGR
const DISABLE_AUTO_CONTINUE = process.env.NPQ_DISABLE_AUTO_CONTINUE === 'true'

const cliArgs = CliParser.parseArgsMinimal()

const silentModeNoPackages = !cliArgs || !cliArgs.packages || cliArgs.packages.length === 0

const isInteractive = cliSupport.isInteractiveTerminal() && !silentModeNoPackages
const spinner = isInteractive ? new Spinner({ text: 'Initiating...' }) : null

if (spinner) {
  spinner.start()
}

RegistryConfig.load({ argv: cliArgs.registryConfigArgs || [] })
  .then((registryConfig) => {
    const registryClient = new RegistryClient(registryConfig)
    const marshall = new Marshall({
      pkgs: cliArgs.packages,
      registryClient,
      progressManager: spinner,
      promiseThrottleHelper
    })
    return marshall.process()
  })
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
      const { countErrors, countWarnings, countNotEvaluated = 0, useRichFormatting } = results
      const hasFindings = countErrors > 0 || countWarnings > 0
      const hasReportableResults = hasFindings || countNotEvaluated > 0

      if (hasReportableResults) {
        console.log()
        console.log(hasFindings ? 'Packages with issues found:' : 'Package checks not evaluated:')

        if (useRichFormatting) {
          console.log(results.resultsForPrettyPrint)
          console.log(results.summaryForPrettyPrint)
        } else {
          console.log(results.resultsForPlainTextPrint)
          console.log(results.summaryForPlainTextPrint)
        }
      }

      return {
        anyIssues: hasFindings,
        countErrors,
        countWarnings,
        countNotEvaluated
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
        // Check if auto-continue is disabled via environment variable
        if (DISABLE_AUTO_CONTINUE) {
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
      return pkgMgr.process(PACKAGE_MANAGER_TOOL)
    }
  })
  .then((exitCode) => {
    if (typeof exitCode === 'number') {
      process.exitCode = exitCode
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
