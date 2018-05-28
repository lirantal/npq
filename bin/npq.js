#!/usr/bin/env node
'use strict'

// Require minimum node version or bail out
const cliSupport = require('../lib/helpers/cliSupportHandler')
cliSupport.isEnvSupport() || cliSupport.noSupportError(true)

const inquirer = require('inquirer')
const cli = require('../lib/cli')
const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')

const marshall = new Marshall({
  pkgs: cli.package
})

marshall
  .process()
  .then(result => {
    if (cli.dryRun) {
      process.exit(0)
    }

    if (result && result.error) {
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
  .then(status => {
    if (status && status.hasOwnProperty('install') && status.install === true) {
      pkgMgr.process(cli.packageManager, cli.package)
    }
  })
  .catch(error => {
    console.error(error)
    process.exit(-1)
  })
