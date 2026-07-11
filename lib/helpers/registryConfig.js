'use strict'

const path = require('node:path')
const Config = require('@npmcli/config')
const npmFetch = require('npm-registry-fetch')
const {
  definitions,
  flatten,
  nerfDarts,
  shorthands
} = require('@npmcli/config/lib/definitions')
const { RegistryError, sanitizeRegistryUrl } = require('./registryErrors')

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

function normalizeRegistry(value) {
  const url = new URL(value || DEFAULT_REGISTRY)
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/'
  }
  return url.toString()
}

class RegistryConfig {
  constructor(requestOptions) {
    this.requestOptions = Object.freeze({
      ...requestOptions,
      registry: normalizeRegistry(requestOptions.registry)
    })
  }

  static defaults() {
    return new RegistryConfig({ registry: DEFAULT_REGISTRY })
  }

  static async load({ argv = [], env = process.env, cwd = process.cwd() } = {}) {
    try {
      const registryArg = argv.find((arg) => arg.startsWith('--registry='))
      if (registryArg) {
        normalizeRegistry(registryArg.slice('--registry='.length))
      }

      const config = new Config({
        npmPath: path.resolve(__dirname, '..'),
        definitions,
        shorthands,
        flatten,
        nerfDarts,
        argv: ['node', 'npq', ...argv],
        env,
        cwd,
        warn: false
      })
      await config.load()
      if (!config.validate()) {
        throw new Error('Invalid npm configuration')
      }
      return new RegistryConfig(config.flat)
    } catch (error) {
      const code =
        error.code === 'ERR_INVALID_AUTH' ? 'EREGISTRYCONFIGAUTH' : 'EREGISTRYCONFIG'
      const message =
        error.code === 'ERR_INVALID_AUTH'
          ? 'Invalid npm registry authentication configuration'
          : `Unable to load npm registry configuration: ${error.code || error.name}`
      throw new RegistryError(message, { code, cause: error })
    }
  }

  registryFor(packageSpec) {
    return normalizeRegistry(npmFetch.pickRegistry(packageSpec, this.requestOptions))
  }

  describeRegistry(packageSpec) {
    return sanitizeRegistryUrl(this.registryFor(packageSpec))
  }
}

module.exports = RegistryConfig
