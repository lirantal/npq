'use strict'

const yargs = require('yargs')
const cliCommons = require('./cliCommons')

const argv = yargs
  .version()
  .usage('Usage: npq install <package> [options]')
  .help('help')
  .alias('help', 'h')
  .options(cliCommons.getOptions())
  .command(cliCommons.getInstallCommand())
  .command({
    command: '--packageManager [packageManager]',
    aliases: ['--pkgMgr'],
    desc: 'the package manager to offload handling the command',
    builder: yargs => yargs.default('packageManager', 'npm')
  })
  .command({
    command: '--dry-run',
    desc:
      'npq will run checks only and will not proceed with actually installing a package'
  })
  .example('npq install express')
  .epilogue('curated by Liran Tal at https://github.com/lirantal/npq').argv

module.exports = argv
