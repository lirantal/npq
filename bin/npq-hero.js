#!/usr/bin/env node
'use strict'

// Require minimum node version or bail out
const cliSupport = require('../lib/helpers/cliSupportHandler')
cliSupport.isEnvSupport() || (cliSupport.noSupportError() && cliSupport.packageManagerPassthrough())

const inquirer = require('inquirer')
const yargs = require('yargs')
const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')
const cliCommons = require('../lib/cliCommons')
const { reportResults } = require('../lib/helpers/reportResults')

const PACKAGE_MANAGER_TOOL = process.env.NPQ_PKG_MGR

const cli = yargs
  .options(cliCommons.getOptions())
  .command(cliCommons.getInstallCommand())
  .help(false)
  .version(false).argv

const marshall = new Marshall({
  pkgs: cli.package
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
    if (result && result.error) {
      // eslint-disable-next-line no-console
      console.log()
      return inquirer.prompt([
        {
          type: 'confirm',
          name: 'install',
          message: 'Would you like to continue installing package(s)?',
          default: false
        }
      ])
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
