'use strict'

const BaseMarshall = require('./baseMarshall')
const Warning = require('../helpers/warning')
const NpmRegistry = require('../helpers/npmRegistry')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'signatures'

let registryKeysCache = null

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
    const npmRegistry = new NpmRegistry({
      registry: 'https://registry.npmjs.org'
    })

    return this.fetchRegistryKeys()
      .then((keys) => {
        return npmRegistry
          .getManifest(`${pkg.packageName}@${pkg.packageVersion}`)
          .then((manifest) => npmRegistry.verifySignatures(manifest, keys))
      })
      .then((metadata) => {
        return metadata
      })
      .catch((error) => {
        // Handle specific error cases
        if (
          error.message &&
          error.message.includes('but the corresponding public key has expired')
        ) {
          // if the error is about an expired key, we throw a warning
          // instead of an error, so that the process can continue
          throw new Warning(`Package is signed with an expired key`)
        }

        throw new Warning(`Unable to verify package signature on registry: ${error.message}`)
      })
  }

  fetchRegistryKeys() {
    if (registryKeysCache) {
      return Promise.resolve(registryKeysCache)
    }

    const registryHost = 'https://registry.npmjs.org'
    const registryKeysEndpoint = '/-/npm/v1/keys'

    const registryKeysUrl = `${registryHost}${registryKeysEndpoint}`
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
        // save it in the cached singleton object
        registryKeysCache = keys
        return keys
      })
      .catch((error) => {
        throw new Warning(`Error fetching registry keys: ${error.message}`)
      })
  }
}

module.exports = Marshall
