'use strict'

const BaseMarshall = require('./baseMarshall')
const Warning = require('../helpers/warning')
const NpmRegistry = require('../helpers/npmRegistry')
const NotEvaluated = require('../helpers/notEvaluated')
const { RegistryError } = require('../helpers/registryErrors')
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

  async validate(pkg) {
    const verifier = new NpmRegistry()

    try {
      const packageInfo = await this.packageRepoUtils.getPackageInfo(pkg.packageName)
      const resolvedVersion = await this.resolvePackageVersion(
        pkg.packageName,
        pkg.packageVersion,
        packageInfo
      )

      if (!resolvedVersion) {
        throw new Error(
          `Unable to resolve version ${pkg.packageVersion} for package ${pkg.packageName}`
        )
      }

      const manifest = await this.registryClient.getManifest(
        `${pkg.packageName}@${resolvedVersion}`,
        packageInfo
      )
      if (!manifest.dist || !manifest.dist.signatures) {
        return await verifier.verifySignatures(manifest, [])
      }
      const keys = await this.registryClient.getRegistryKeys(pkg.packageName)
      return await verifier.verifySignatures(manifest, keys)
    } catch (error) {
      if (error instanceof NotEvaluated || error instanceof RegistryError) {
        throw error
      }
      if (error.message && error.message.includes('but the corresponding public key has expired')) {
        throw new Warning('Package is signed with an expired key')
      }
      throw new Warning(`Unable to verify package signature on registry: ${error.message}`)
    }
  }
}

module.exports = Marshall
