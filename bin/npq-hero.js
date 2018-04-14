#!/usr/bin/env node
'use strict'

// Require minimum node version or bail out
const cliSupport = require('../lib/helpers/cliSupportHandler')
cliSupport.isEnvSupport() ||
  (cliSupport.noSupportError() && cliSupport.packageManagerPassthrough())

const inquirer = require('inquirer')
const yargs = require('yargs')
const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')

const PACKAGE_MANAGER_TOOL = process.env.NPQ_PKG_MGR

const cli = yargs
  .command({
    command: 'install [package...]',
    aliases: ['i', 'add'],
    desc: 'install a package'
  })
  .help(false)
  .version(false).argv

const marshall = new Marshall({
  pkgs: cli.package
})

marshall
  .process()
  .then(result => {
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
      pkgMgr.process(PACKAGE_MANAGER_TOOL, cli.package)
    }
  })
  .catch(error => {
    console.error(error)
    process.exit(-1)
  })
