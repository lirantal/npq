/* eslint-disable no-console */
'use strict'

// const util = require('node:util')
const Marshalls = require('./marshalls')
const PackageRepoUtils = require('./helpers/packageRepoUtils')
// const { marshallCategories } = require('./marshalls/constants')

class Marshall {
  constructor(options = {}) {
    this.pkgs = options ? options.pkgs : null
    this.packageRepoUtils = new PackageRepoUtils()
    this.progressManager = options.progressManager || null
    this.promiseThrottleHelper = options.promiseThrottleHelper || null
  }

  async process() {
    // nothing to do? move on
    if (!this.pkgs) {
      return Promise.resolve()
    }

    this.progressManager.update('Analyzing...')

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

    this.progressManager.stop()

    return promiseResultsPerPackage
  }

  async createPackageAuditFunction(pkg, packageRepoUtils) {
    const allPackages = Array.isArray(pkg) ? pkg : [pkg]
    const config = {
      pkgs: this.createPackageVersionMaps(allPackages),
      packageRepoUtils: packageRepoUtils
    }
    return Marshalls.tasks(config, this.progressManager)
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
