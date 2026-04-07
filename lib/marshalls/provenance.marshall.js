'use strict'

const semver = require('semver')
const BaseMarshall = require('./baseMarshall')
const NpmRegistry = require('../helpers/npmRegistry')
const Warning = require('../helpers/warning')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'provenance'

/**
 * Newest semver older than installedVersion whose packument entry includes dist.attestations.
 * Uses only packageInfo already returned by getPackageInfo (no extra HTTP).
 */
function findNewestPriorVersionWithDistAttestations(packageInfo, installedVersion) {
  if (!packageInfo?.versions || !semver.valid(installedVersion)) {
    return null
  }

  const older = Object.keys(packageInfo.versions)
    .filter((v) => semver.valid(v) && semver.lt(v, installedVersion))
    .sort(semver.rcompare)

  for (const v of older) {
    if (packageInfo.versions[v]?.dist?.attestations) {
      return v
    }
  }

  return null
}

/**
 * Whether this error means the resolved version did not yield verifiable provenance,
 * as opposed to infrastructure failures (manifest fetch, keys, attestations URL fetch).
 */
function shouldConsiderProvenanceRegression(error) {
  if (!error || typeof error.message !== 'string') {
    return false
  }

  if (error.message.includes('Package has no attestations to verify')) {
    return true
  }

  if (error.code === 'EATTESTATIONVERIFY') {
    if (error.message.includes('malformed checkpoint')) {
      return false
    }
    return true
  }

  if (
    error.code === 'EMISSINGSIGNATUREKEY' ||
    error.code === 'EEXPIREDSIGNATUREKEY' ||
    error.code === 'EATTESTATIONSUBJECT'
  ) {
    return true
  }

  if (error.message.includes('failed to verify attestation')) {
    return true
  }

  return false
}

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.SupplyChainSecurity.id
  }

  title() {
    return 'Verifying package provenance'
  }

  throwIfProvenanceRegression(validationMetadata) {
    const prior = findNewestPriorVersionWithDistAttestations(
      validationMetadata.packageInfo,
      validationMetadata.version
    )

    if (prior) {
      throw new Error(
        `Provenance regression detected: published version ${prior} includes npm provenance metadata, but ${validationMetadata.name}@${validationMetadata.version} does not (or it could not be verified).`
      )
    }
  }

  validate(pkg) {
    const validationMetadata = {}
    const npmRegistry = new NpmRegistry({
      registry: 'https://registry.npmjs.org'
    })

    return this.packageRepoUtils
      .getPackageInfo(pkg.packageName)
      .then(async (packageInfo) => {
        const packageName = packageInfo.name

        // Use the resolvePackageVersion method to handle version ranges properly
        const packageVersion = await this.resolvePackageVersion(
          pkg.packageName,
          pkg.packageVersion,
          packageInfo
        )

        validationMetadata.name = packageName
        validationMetadata.version = packageVersion
        validationMetadata.packageInfo = packageInfo

        if (!validationMetadata.version) {
          throw new Error('Unable to find version or dist-tag for package')
        }

        return validationMetadata
      })
      .then((validationMetadata) => {
        return this.fetchRegistryKeys().then((keys) => {
          return npmRegistry
            .getManifest(`${validationMetadata.name}@${validationMetadata.version}`)
            .then((manifest) => npmRegistry.verifyAttestations(manifest, keys))
        })
      })
      .then((metadata) => {
        if (!metadata || !metadata._attestations) {
          this.throwIfProvenanceRegression(validationMetadata)
          throw new Warning('the package was published without any attestations')
        }

        const attestations = metadata._attestations
        return attestations
      })
      .catch((error) => {
        // We can ignore this type of error, false positive
        // See: https://github.com/lirantal/npq/issues/329
        if (error.code === 'EATTESTATIONVERIFY' && error.message.includes('malformed checkpoint')) {
          return []
        }

        if (error instanceof Warning && error.message.includes('Error fetching registry keys')) {
          throw error
        }

        if (shouldConsiderProvenanceRegression(error)) {
          this.throwIfProvenanceRegression(validationMetadata)
        }

        if (error.message.includes('Package has no attestations to verify')) {
          throw new Warning(
            `Unable to verify provenance: the package was published without any attestations`
          )
        }

        this.debug(
          '\nUnable to verify provenance for package %s@%s: %s',
          validationMetadata.name,
          validationMetadata.version,
          error.message
        )
        throw new Warning(`Unable to verify provenance`)
      })
  }

  fetchRegistryKeys() {
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
        return keys
      })
      .catch((error) => {
        throw new Warning(`Error fetching registry keys: ${error.message}`)
      })
  }
}

module.exports = Marshall
