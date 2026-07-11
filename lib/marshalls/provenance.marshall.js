'use strict'

const semver = require('semver')
const BaseMarshall = require('./baseMarshall')
const NpmRegistry = require('../helpers/npmRegistry')
const Warning = require('../helpers/warning')
const NotEvaluated = require('../helpers/notEvaluated')
const { RegistryError } = require('../helpers/registryErrors')
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
  const msg = error && typeof error.message === 'string' ? error.message : ''
  if (!msg) {
    return false
  }

  if (msg.includes('Package has no attestations to verify')) {
    return true
  }

  // Malformed checkpoint (#329) is handled in validate() before this runs.
  if (error.code === 'EATTESTATIONVERIFY') {
    return true
  }

  if (
    error.code === 'EMISSINGSIGNATUREKEY' ||
    error.code === 'EEXPIREDSIGNATUREKEY' ||
    error.code === 'EATTESTATIONSUBJECT'
  ) {
    return true
  }

  if (msg.includes('failed to verify attestation')) {
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

  async validate(pkg) {
    const validationMetadata = {}
    const verifier = new NpmRegistry()

    try {
      const packageInfo = await this.packageRepoUtils.getPackageInfo(pkg.packageName)
      validationMetadata.name = packageInfo.name
      validationMetadata.version = await this.resolvePackageVersion(
        pkg.packageName,
        pkg.packageVersion,
        packageInfo
      )
      validationMetadata.packageInfo = packageInfo

      if (!validationMetadata.version) {
        throw new Error('Unable to find version or dist-tag for package')
      }

      const manifest = await this.registryClient.getManifest(
        `${validationMetadata.name}@${validationMetadata.version}`,
        packageInfo
      )
      let metadata
      if (!manifest.dist || !manifest.dist.attestations) {
        metadata = await verifier.verifyAttestations(manifest, [], null)
      } else {
        const [keys, attestations] = await Promise.all([
          this.registryClient.getRegistryKeys(validationMetadata.name),
          this.registryClient.getAttestations(validationMetadata.name, manifest)
        ])
        metadata = await verifier.verifyAttestations(manifest, keys, attestations)
      }

      if (!metadata || !metadata._attestations) {
        this.throwIfProvenanceRegression(validationMetadata)
        throw new Warning('the package was published without any attestations')
      }
      return metadata._attestations
    } catch (error) {
      if (error instanceof NotEvaluated || error instanceof RegistryError) {
        throw error
      }
      if (error.code === 'EATTESTATIONVERIFY' && error.message.includes('malformed checkpoint')) {
        return []
      }
      if (
        error instanceof Error &&
        error.message === 'Unable to find version or dist-tag for package'
      ) {
        throw error
      }
      if (
        error instanceof Warning &&
        error.message === 'the package was published without any attestations'
      ) {
        throw error
      }
      if (shouldConsiderProvenanceRegression(error)) {
        this.throwIfProvenanceRegression(validationMetadata)
      }
      if (error.message.includes('Package has no attestations to verify')) {
        throw new Warning(
          'Unable to verify provenance: the package was published without any attestations'
        )
      }

      this.debug(
        '\nUnable to verify provenance for package %s@%s: %s',
        validationMetadata.name,
        validationMetadata.version,
        error.message
      )
      throw new Warning('Unable to verify provenance')
    }
  }
}

module.exports = Marshall
