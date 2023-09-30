'use strict'

const BaseMarshall = require('./baseMarshall')
const pacote = require('pacote')
const Warning = require('../helpers/warning')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'provenance'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.SupplyChainSecurity.id
  }

  title() {
    return 'Verifying package provenance'
  }

  validate(pkg) {
    const validationMetadata = {}

    return this.packageRepoUtils
      .getPackageInfo(pkg.packageName)
      .then((packageInfo) => {
        const packageName = packageInfo.name
        const packageVersion =
          pkg.packageVersion === 'latest'
            ? packageInfo['dist-tags'] && packageInfo['dist-tags'].latest
            : this.packageRepoUtils.parsePackageVersion(pkg.packageVersion).version

        validationMetadata.name = packageName
        validationMetadata.version = packageVersion
      })
      .then(() => {
        return this.fetchRegistryKeys()
      })
      .then((keys) => {
        // @TODO currently we're hardcoding the official npm registry
        // this should however allow for local proxies and other registries
        return pacote.manifest(`${validationMetadata.name}@${validationMetadata.version}`, {
          verifyAttestations: true,
          registry: 'https://registry.npmjs.org',

          '//registry.npmjs.org/:_keys': keys
        })
      })
      .then((metadata) => {
        if (!metadata || !metadata._attestations) {
          throw new Warning('the package was published without any attestations.')
        }

        const attestations = metadata._attestations

        return attestations
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
        throw new Error(`error fetching registry keys: ${error.message}`)
      })
  }
}

module.exports = Marshall
