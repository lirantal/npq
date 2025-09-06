'use strict'

// const semver = require('semver')
const BaseMarshall = require('./baseMarshall')
const NpmRegistry = require('../helpers/npmRegistry')
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
    const npmRegistry = new NpmRegistry({
      registry: 'https://registry.npmjs.org'
    })

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
        validationMetadata.packageInfo = packageInfo

        if (!validationMetadata.version) {
          throw new Error('Unable to find version or dist-tag for package')
        }
      })
      .then(() => {
        return this.fetchRegistryKeys()
      })
      .then((keys) => {
        return npmRegistry
          .getManifest(`${validationMetadata.name}@${validationMetadata.version}`)
          .then((manifest) => npmRegistry.verifyAttestations(manifest, keys))
      })
      .then((metadata) => {
        if (!metadata || !metadata._attestations) {
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
        } else {
          if (error.message.includes('Package has no attestations to verify')) {
            throw new Warning(
              `Unable to verify provenance: the package was published without any attestations`
            )
          } else {
            this.debug(
              '\nUnable to verify provenance for package %s@%s: %s',
              validationMetadata.name,
              validationMetadata.version,
              error.message
            )
            throw new Warning(`Unable to verify provenance`)
          }
        }
      })
  }

  /*
  async checkProvenanceRegression(validationMetadata) {
    const { packageInfo, name, version } = validationMetadata
    
    if (!packageInfo || !packageInfo.versions) {
      return // Cannot check regression without version information
    }

    const allVersions = Object.keys(packageInfo.versions)
    const validVersions = allVersions.filter(v => semver.valid(v))
    
    if (validVersions.length === 0) {
      return // No valid versions to compare
    }

    // Get all versions older than the target version
    const olderVersions = validVersions
      .filter(v => semver.lt(v, version))
      .sort(semver.rcompare) // Sort descending, newest first

    if (olderVersions.length === 0) {
      return // No older versions to check
    }

    // Check if any older versions had provenance
    let hasProvenanceRegressionDetected = false
    const versionWithProvenance = []

    // NOTE: Going back all versions and fetching their manifest to check provenance
    // is going to be very slow. We can limit this function to go back just 2-3 versions
    // and then stop there
    for (const olderVersion of olderVersions) {
      try {
        const keys = await this.fetchRegistryKeys()
        const metadata = await pacote.manifest(`${name}@${olderVersion}`, {
          verifyAttestations: true,
          registry: 'https://registry.npmjs.org',
          '//registry.npmjs.org/:_keys': keys
        })

        if (metadata && metadata._attestations) {
          versionWithProvenance.push(olderVersion)
          hasProvenanceRegressionDetected = true
        }
      } catch (error) {
        // Ignore errors for older versions as they might not have provenance
        // We only care if they successfully had provenance before
        continue
      }
    }

    // If older versions had provenance, check if current version lacks it
    if (hasProvenanceRegressionDetected) {
      try {
        const keys = await this.fetchRegistryKeys()
        const currentMetadata = await pacote.manifest(`${name}@${version}`, {
          verifyAttestations: true,
          registry: 'https://registry.npmjs.org',
          '//registry.npmjs.org/:_keys': keys
        })

        if (!currentMetadata || !currentMetadata._attestations) {
          const latestVersionWithProvenance = versionWithProvenance[0] // First is the newest
          throw new Error(
            `Provenance regression detected: Previous version ${latestVersionWithProvenance} had provenance attestations, but version ${version} does not. This represents a security downgrade.`
          )
        }
      } catch (error) {
        // If it's our custom error, re-throw it
        if (error.message.includes('Provenance regression detected')) {
          throw error
        }
        
        // If it's a verification error, the current version lacks valid provenance
        if (error.code === 'EATTESTATIONVERIFY' || error.message.includes('attestations')) {
          const latestVersionWithProvenance = versionWithProvenance[0]
          throw new Error(
            `Provenance regression detected: Previous version ${latestVersionWithProvenance} had provenance attestations, but version ${version} does not. This represents a security downgrade.`
          )
        }
        
        // For other errors, treat as if current version lacks provenance
        const latestVersionWithProvenance = versionWithProvenance[0]
        throw new Error(
          `Provenance regression detected: Previous version ${latestVersionWithProvenance} had provenance attestations, but version ${version} does not. This represents a security downgrade.`
        )
      }
    }
  }
  */

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
