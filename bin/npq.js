#!/usr/bin/env node
'use strict'

// Require minimum node version or bail out
const cliSupport = require('../lib/helpers/cliSupportHandler')
cliSupport.isEnvSupport() || cliSupport.noSupportError(true)

const inquirer = require('inquirer')
const cli = require('../lib/cli/npq')
const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')
const DependencyResolver = require('../lib/dependencyResolver')

console.log('cli', cli);

if (cli._[0] === 'install') {
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
    .then(status => {
      if (status && status.hasOwnProperty('install') && status.install === true) {
        pkgMgr.process(cli.packageManager)
      }
    })
    .catch(error => {
      // eslint-disable-next-line no-console
      console.error(error)
      process.exit(-1)
    })
} else if (cli._[0] === 'check') {
  let dependencyResolver

  try {
    dependencyResolver = new DependencyResolver()
    dependencyResolver.resolvePackageJson()
    dependencyResolver.getDependencies({ noDev: !cli.dev })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error while fetching the list of installed dependencies', err)
    process.exit(-1)
  }

  const marshall = new Marshall({
    pkgs: dependencyResolver.dependencies
  })

  // eslint-disable-next-line no-console
  console.log(`Running marshalls against ${dependencyResolver.dependencies.length} dependencies:`)
  marshall
    .process()
    .then(result => {
      if (result && result.error) {
        throw new Error(result.error)
      }
    })
    .catch(() => {
      process.exit(-1)
    })
} else {
  console.error(`Unknown command ${cli._[0]}`)
  process.exit(-1)
}
