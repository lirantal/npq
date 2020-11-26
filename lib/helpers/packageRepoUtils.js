'use strict'

const fetch = require('node-fetch')
const semver = require('semver')
const NPM_REGISTRY = 'http://registry.npmjs.org'
const NPM_REGISTRY_API = 'https://api.npmjs.org'

class PackageRepoUtils {
  constructor (options = {}) {
    this.registryUrl = options.registryUrl ? options.registryUrl : NPM_REGISTRY
    this.registryApiUrl = options.registryApiUrl
      ? options.registryApiUrl
      : NPM_REGISTRY_API
    this.pkgInfoCache = {}
  }

  formatPackageForUrl (pkg) {
    return pkg.replace('/', '%2F')
  }

  getPackageInfo (pkg) {
    if (this.pkgInfoCache[pkg]) {
      return Promise.resolve(this.pkgInfoCache[pkg])
    } else {
      return fetch(`${this.registryUrl}/${this.formatPackageForUrl(pkg)}`)
        .then(response => {
          this.pkgInfoCache[pkg] = response.data
          return response.data
        })
    }
  }

  getLatestVersion (pkg) {
    return this.getPackageInfo(pkg)
      .then(data => {
        return data['dist-tags'] &&
          data['dist-tags']['latest']
          ? data['dist-tags']['latest']
          : null
      })
  }

  getDownloadInfo (pkg) {
    return fetch(`${this.registryApiUrl}/downloads/point/last-month/${pkg}`)
      .then(response => {
        return response.data['downloads']
      })
  }

  getReadmeInfo (pkg) {
    return this.getPackageInfo(pkg)
      .then(data => {
        return data['readme']
      })
  }

  getLicenseInfo (pkg) {
    return this.getPackageInfo(pkg)
      .then(data => {
        return data['license']
      })
  }

  parsePackageVersion (version) {
    return semver.coerce(version)
  }
}

module.exports = PackageRepoUtils
