'use strict'

// const util = require('node:util')
const Marshalls = require('./marshalls')
const PackageRepoUtils = require('./helpers/packageRepoUtils')
const RegistryClient = require('./helpers/registryClient')
// const { marshallCategories } = require('./marshalls/constants')

class Marshall {
  constructor(options = {}) {
    options = options || {}
    this.pkgs = options.pkgs || null
    this.registryClient =
      options.registryClient || options.packageRepoUtils?.registryClient || RegistryClient.public()
    this.packageRepoUtils =
      options.packageRepoUtils || new PackageRepoUtils({ registryClient: this.registryClient })
    this.progressManager = options.progressManager || null
    this.promiseThrottleHelper = options.promiseThrottleHelper || null
    this.preserveRequestOrder = options.preserveRequestOrder === true
    this.suppressOutput = options.suppressOutput === true
    this.onAuditFailure =
      typeof options.onAuditFailure === 'function' ? options.onAuditFailure : null
  }

  async process() {
    // nothing to do? move on
    if (!this.pkgs) {
      return Promise.resolve()
    }

    if (this.progressManager) {
      this.progressManager.update('Analyzing...')
    }

    const promises = this.pkgs.map((pkg) => {
      if (!this.promiseThrottleHelper) {
        return this.createPackageAuditFunction(pkg, this.packageRepoUtils)
      } else {
        // use the promise throttler to limit concurrency
        return this.promiseThrottleHelper(
          () => {
            return this.createPackageAuditFunction(pkg, this.packageRepoUtils)
          },
          1,
          50
        ) // max 1 concurrent, 0.1 second delay
      }
    })
    const res = await Promise.all(promises)

    // match pkgs array with results of promises
    const promiseResultsPerPackage = this.pkgs.reduce((acc, pkg, index) => {
      acc[pkg] = res[index]
      return acc
    }, {})

    if (this.progressManager) {
      this.progressManager.stop()
    }

    if (this.preserveRequestOrder) return res
    return promiseResultsPerPackage
  }

  async createPackageAuditFunction(pkg, packageRepoUtils) {
    const allPackages = Array.isArray(pkg) ? pkg : [pkg]
    const config = {
      pkgs: this.createPackageVersionMaps(allPackages),
      packageRepoUtils: packageRepoUtils,
      registryClient: this.registryClient
    }
    return Marshalls.tasks(config, this.progressManager, {
      onAuditFailure: this.onAuditFailure,
      suppressOutput: this.suppressOutput
    })
  }

  createPackageVersionMaps(packages) {
    const packageVersionMapping = packages.reduce((prev, curr) => {
      const versionSymbolPosition = curr.lastIndexOf('@')
      const versionPosition =
        versionSymbolPosition === -1 || versionSymbolPosition === 0
          ? curr.length
          : versionSymbolPosition

      prev.push({
        packageName: curr.substr(0, versionPosition),
        packageVersion: curr.substr(versionPosition + 1) || 'latest',
        packageString: curr
      })

      return prev
    }, [])

    return packageVersionMapping
  }
}

module.exports = Marshall
