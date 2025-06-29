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

const PACKAGE_MANAGER_TOOL = process.env.NPQ_PKG_MGR

const cliArgs = CliParser.parseArgsMinimal()
const spinner = new Spinner({ text: 'Initiating...' })
spinner.start()

const marshall = new Marshall({
  pkgs: cliArgs.packages,
  progressManager: spinner
})

marshall
  .process()
  .then((marshallResults) => {
    spinner.stop()

    const results = reportResults(marshallResults)
    if (results) {
      const { countErrors, countWarnings } = results
      return {
        error: countErrors > 0 || countWarnings > 0,
        countErrors,
        countWarnings
      }
    }
    return undefined
  })
  .then((result) => {
    if (result && result.error) {
      // eslint-disable-next-line no-console
      console.log()
      return cliPrompt.prompt({
        name: 'install',
        message: 'Continue install ?',
        default: false
      })
    }

    return { install: true }
  })
  .then((status) => {
    if (status && status.hasOwnProperty('install') && status.install === true) {
      pkgMgr.process(PACKAGE_MANAGER_TOOL)
    }
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(-1)
  })
