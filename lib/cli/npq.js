'use strict'

const yargs = require('yargs')
const cliCommons = require('./commons')

const argv = yargs
  .version()
  .usage('Usage: $0 <command> [arguments] [options]')
  .alias('help', 'h')
  .alias('version', 'v')
  .command(cliCommons.getInstallCommand())
  .command(cliCommons.getCheckCommand())
  .example('$0 install express', '')
  .example('$0 check', '')
  .epilogue('curated by Liran Tal at https://github.com/lirantal/npq')
  .argv

module.exports = argv
