'use strict'

const semver = require('semver')
const RegistryClient = require('./registryClient')
const resolveManifest = require('./resolveManifest')

class PackageRepoUtils {
  constructor({ registryClient = RegistryClient.public() } = {}) {
    this.registryClient = registryClient
    this.pkgInfoCache = {}
  }

  getPackageInfo(pkg) {
    const cacheKey = `${this.registryClient.registryFor(pkg)}|${pkg}`
    if (this.pkgInfoCache[cacheKey]) {
      return Promise.resolve(this.pkgInfoCache[cacheKey])
    }
    return this.registryClient.getPackageInfo(pkg).then((data) => {
      this.pkgInfoCache[cacheKey] = data
      return data
    })
  }

  getLatestVersion(pkg) {
    return this.getPackageInfo(pkg).then((data) => {
      return data['dist-tags'] && data['dist-tags'].latest ? data['dist-tags'].latest : null
    })
  }

  getDownloadInfo(pkg) {
    return this.registryClient.getDownloadInfo(pkg)
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
    const packageInfo = await this.getPackageInfo(packageName)
    return resolveManifest(
      packageName,
      packageVersion,
      packageInfo,
      this.registryClient.registryConfig?.requestOptions
    ).version
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
