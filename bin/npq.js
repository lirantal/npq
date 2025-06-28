#!/usr/bin/env node
'use strict'

// Require minimum node version or bail out
const cliSupport = require('../lib/helpers/cliSupportHandler')
cliSupport.isEnvSupport() || cliSupport.noSupportError(true)

const { CliParser } = require('../lib/cli')
const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')
const cliPrompt = require('../lib/helpers/cliPrompt.js')
const { reportResults } = require('../lib/helpers/reportResults')

const cliArgs = CliParser.parseArgsFull()

const marshall = new Marshall({
  pkgs: cliArgs.packages
})

marshall
  .process()
  .then((marshallResults) => {
    const { countErrors, countWarnings } = reportResults(marshallResults)
    return {
      error: countErrors > 0 || countWarnings > 0,
      countErrors,
      countWarnings
    }
  })
  .then((result) => {
    if (cliArgs.dryRun) {
      process.exit(0)
    }

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
      pkgMgr.process(cliArgs.packageManager)
    }
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(-1)
  })
