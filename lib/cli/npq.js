'use strict'

const yargs = require('yargs')
const cliCommons = require('./commons')

const argv = yargs
  .version()
  .usage('Usage: npq install <package> [options]')
  .help('help')
  .alias('help', 'h')
  .options(cliCommons.getOptions())
  .command(cliCommons.getInstallCommand())
  .example('npq install express')
  .epilogue('curated by Liran Tal at https://github.com/lirantal/npq').argv

module.exports = argv
