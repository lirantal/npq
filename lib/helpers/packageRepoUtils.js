'use strict'

const semver = require('semver')
const NPM_REGISTRY = 'http://registry.npmjs.org'
const NPM_REGISTRY_API = 'https://api.npmjs.org'

class PackageRepoUtils {
  constructor(options = {}) {
    this.registryUrl = options.registryUrl ? options.registryUrl : NPM_REGISTRY
    this.registryApiUrl = options.registryApiUrl ? options.registryApiUrl : NPM_REGISTRY_API
    this.pkgInfoCache = {}
  }

  formatPackageForUrl(pkg) {
    return pkg.replace(/\//g, '%2F')
  }

  getPackageInfo(pkg) {
    if (this.pkgInfoCache[pkg]) {
      return Promise.resolve(this.pkgInfoCache[pkg])
    } else {
      return fetch(`${this.registryUrl}/${this.formatPackageForUrl(pkg)}`)
        .then((response) => response.json())
        .then((data) => {
          this.pkgInfoCache[pkg] = data
          return data
        })
    }
  }

  getLatestVersion(pkg) {
    return this.getPackageInfo(pkg).then((data) => {
      return data['dist-tags'] && data['dist-tags'].latest ? data['dist-tags'].latest : null
    })
  }

  getDownloadInfo(pkg) {
    return fetch(`${this.registryApiUrl}/downloads/point/last-month/${pkg}`)
      .then((response) => response.json())
      .then(({ downloads }) => downloads)
  }

  getReadmeInfo(pkg) {
    return this.getPackageInfo(pkg).then(({ readme }) => readme)
  }

  getLicenseInfo(pkg) {
    return this.getPackageInfo(pkg).then(({ license }) => license)
  }

  parsePackageVersion(version) {
    return semver.coerce(version)
  }

  isPackageInAllowList(packageName) {
    const allowList = ['npq', 'ai', 'bun', 'deno']
    return allowList.includes(packageName)
  }

  async getSemVer(packageName, packageVersion) {
    if (semver.valid(packageVersion)) {
      return packageVersion
    } else {
      // this is probably an alias such as `latest` that we need to match
      // via dist-tags:
      const packageInfo = await this.getPackageInfo(packageName)

      if (packageInfo['dist-tags'] === undefined) {
        throw new Error(`Could not find dist-tags for package ${packageName}`)
      }

      if (packageInfo['dist-tags'][packageVersion] !== undefined) {
        const semverVersion = packageInfo['dist-tags'][packageVersion]
        return semverVersion
      }

      // If not found in dist-tags, try to find the highest version that satisfies
      // the semver range from the versions object
      if (packageInfo.versions) {
        const availableVersions = Object.keys(packageInfo.versions).filter((v) => semver.valid(v))

        try {
          const satisfyingVersion = semver.maxSatisfying(availableVersions, packageVersion)

          if (satisfyingVersion) {
            return satisfyingVersion
          }
        } catch (error) {
          // semver.maxSatisfying throws if the range is invalid, continue to error below
        }
      }

      throw new Error(`Could not find dist-tag ${packageVersion} for package ${packageName}`)
    }
  }
}

module.exports = PackageRepoUtils
