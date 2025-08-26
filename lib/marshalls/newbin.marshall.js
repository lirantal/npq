'use strict'

const semver = require('semver')
const BaseMarshall = require('./baseMarshall')
const Warning = require('../helpers/warning')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'newBin' // Or a more descriptive name like 'newBinary'

class NewBinMarshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.SupplyChainSecurity.id
  }

  title() {
    return 'Checking for new binaries introduced in package.json'
  }

  async validate(pkg) {
    const fullPackageInfo = await this.packageRepoUtils.getPackageInfo(pkg.packageName)
    if (!fullPackageInfo || !fullPackageInfo.versions) {
      // If we can't get package info or versions, skip
      return
    }

    const targetVersionString = await this.resolvePackageVersion(
      pkg.packageName,
      pkg.packageVersion,
      fullPackageInfo
    )

    if (!targetVersionString || !fullPackageInfo.versions[targetVersionString]) {
      // If target version string can't be resolved or doesn't exist in versions
      return
    }

    const newVersionData = fullPackageInfo.versions[targetVersionString]
    const newBin = this.normalizeBin(newVersionData.bin, newVersionData.name || pkg.packageName)

    const allVersions = Object.keys(fullPackageInfo.versions)
    const olderVersions = allVersions
      .filter((v) => semver.valid(v) && semver.lt(v, targetVersionString))
      .sort(semver.rcompare) // Sorts descending, so first is latest older

    if (olderVersions.length === 0) {
      // No previous version to compare against
      return
    }

    const previousVersionString = olderVersions[0]
    const previousVersionData = fullPackageInfo.versions[previousVersionString]
    const oldBin = this.normalizeBin(
      previousVersionData.bin,
      previousVersionData.name || pkg.packageName
    )

    const newBinaries = Object.keys(newBin).filter(
      (key) => !Object.prototype.hasOwnProperty.call(oldBin, key)
    )

    if (newBinaries.length > 0) {
      newBinaries.forEach((binaryName) => {
        const message = `Package '${pkg.packageString}' introduces a new binary '${binaryName}' (command: '${newBin[binaryName]}') compared to version '${previousVersionString}'.`
        this.setMessage({ pkg: pkg.packageString, message }, true) // true for warning
      })
      // Throw a warning to signal that messages have been set.
      // The base class's checkPackage will catch this and use the messages.
      // Note: We only need to throw one Warning, even if multiple binaries are new.
      // The messages have already been added.

      throw new Warning(`New binaries detected for ${pkg.packageString}`)
    }
  }

  normalizeBin(binField, packageJSONName) {
    if (!binField) {
      return {}
    }
    if (typeof binField === 'string') {
      // If bin is a string, the key is the package name from package.json
      return { [packageJSONName]: binField }
    }
    // If it's already an object, return as is
    return binField
  }
}

module.exports = NewBinMarshall
