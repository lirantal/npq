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
        } catch {
          // semver.maxSatisfying throws if the range is invalid, continue to error below
        }
      }

      throw new Error(`Could not find dist-tag ${packageVersion} for package ${packageName}`)
    }
  }

  /**
   * Extract GitHub owner and repo from a repository URL
   * @param {string} repoUrl - Repository URL (e.g., "git+https://github.com/owner/repo.git")
   * @returns {{owner: string, repo: string} | null} - Owner and repo, or null if not a GitHub URL
   */
  extractGitHubRepoFromUrl(repoUrl) {
    if (!repoUrl || typeof repoUrl !== 'string') {
      return null
    }

    // Match GitHub URLs in various formats:
    // - git+https://github.com/owner/repo.git
    // - https://github.com/owner/repo.git
    // - https://github.com/owner/repo
    // - git://github.com/owner/repo.git
    // - git@github.com:owner/repo.git
    const httpsPattern = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i
    const match = repoUrl.match(httpsPattern)

    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      }
    }

    return null
  }

  /**
   * Check if a GitHub repository is archived
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<boolean>} - True if archived, false otherwise
   * @throws {Error} - On rate limit or API errors
   */
  async isGitHubRepoArchived(owner, repo) {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'npq-package-checker'
    }

    // Use GITHUB_TOKEN if available for higher rate limits
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers
    })

    if (response.status === 403) {
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')
      if (rateLimitRemaining === '0') {
        throw new Error(
          'GitHub API rate limit exceeded - deprecation marshall could not evaluate repository archive status. ' +
            'Set GITHUB_TOKEN environment variable for higher rate limits.'
        )
      }
      throw new Error(
        `GitHub API access forbidden for ${owner}/${repo} - deprecation marshall could not evaluate repository archive status`
      )
    }

    if (response.status === 404) {
      // Repository doesn't exist or is private - can't determine archive status
      return false
    }

    if (!response.ok) {
      throw new Error(
        `GitHub API error (${response.status}) - deprecation marshall could not evaluate repository archive status`
      )
    }

    const data = await response.json()
    return data.archived === true
  }
}

module.exports = PackageRepoUtils
