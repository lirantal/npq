'use strict'

const { parseArgs } = require('node:util')

const BASE_OPTIONS = {
  install: {
    type: 'string',
    short: 'i',
    default: 'install'
  },
  registry: { type: 'string' },
  userconfig: { type: 'string' },
  globalconfig: { type: 'string' }
}

function parsePackageManagerArguments({ packageManager, args }) {
  const options =
    packageManager === 'pnpm'
      ? {
          ...BASE_OPTIONS,
          filter: { type: 'string', short: 'F', multiple: true },
          'filter-prod': { type: 'string', multiple: true }
        }
      : BASE_OPTIONS

  const config = {
    allowPositionals: true,
    strict: false,
    options
  }

  if (args !== undefined) {
    config.args = args
  }

  return parseArgs(config)
}

module.exports.parsePackageManagerArguments = parsePackageManagerArguments
