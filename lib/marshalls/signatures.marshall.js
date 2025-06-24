'use strict'

const BaseMarshall = require('./baseMarshall')
const pacote = require('pacote')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'signatures'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.SupplyChainSecurity.id
  }

  title() {
    return 'Verifying registry signatures for package'
  }

  validate(pkg) {
    // @TODO currently we're hardcoding the official npm registry
    // this should however allow for local proxies and other registries
    return this.fetchRegistryKeys()
      .then((keys) => {
        return pacote.manifest(`${pkg.packageName}@${pkg.packageVersion}`, {
          verifySignatures: true,
          registry: 'https://registry.npmjs.org',

          '//registry.npmjs.org/:_keys': keys
        })
      })
      .then((metadata) => {
        return metadata
      })
      .catch((error) => {
        throw new Error(`Unable to grab package manifest: ${error.message}`)
      })
  }

  fetchRegistryKeys() {
    const registryHost = 'https://registry.npmjs.org'
    const registryKeysEndpoint = '/-/npm/v1/keys'

    const registryKeysUrl = `${registryHost}${registryKeysEndpoint}`
    // eslint-disable-next-line no-undef
    return fetch(registryKeysUrl)
      .then((response) => {
        return response.json()
      })
      .then((response) => {
        const registryKeys = response.keys

        return registryKeys.map((key) => ({
          ...key,
          pemkey: `-----BEGIN PUBLIC KEY-----\n${key.key}\n-----END PUBLIC KEY-----`
        }))
      })
      .then((keys) => {
        return keys
      })
      .catch((error) => {
        throw new Error(`Error fetching registry keys: ${error.message}`)
      })
  }
}

module.exports = Marshall
