'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'deprecation'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
  }

  title() {
    return 'Checking package for deprecation flag'
  }

  async validate(pkg) {
    const data = await this.packageRepoUtils.getPackageInfo(pkg.packageName)

    if (!data) {
      return true
    }

    const packageVersion = await this.resolvePackageVersion(
      pkg.packageName,
      pkg.packageVersion,
      data
    )

    if (!packageVersion) {
      return true
    }

    const packageDeprecated =
      data &&
      data.versions &&
      data.versions[packageVersion] &&
      data.versions[packageVersion].deprecated

    if (packageDeprecated) {
      throw new Error(`Package deprecated: ${packageDeprecated}`)
    }

    // Check if the GitHub repository is archived
    await this.checkGitHubRepoArchived(data)
  }

  /**
   * Check if the package's GitHub repository is archived
   * @param {object} data - Package data from npm registry
   * @throws {Error} - If repository is archived or on API rate limit
   */
  async checkGitHubRepoArchived(data) {
    const repoUrl = data.repository?.url

    if (!repoUrl) {
      return
    }

    const githubRepo = this.packageRepoUtils.extractGitHubRepoFromUrl(repoUrl)

    if (!githubRepo) {
      // @TODO: Add support for GitLab and Bitbucket repository archive detection
      return
    }

    const isArchived = await this.packageRepoUtils.isGitHubRepoArchived(
      githubRepo.owner,
      githubRepo.repo
    )

    if (isArchived) {
      throw new Error('Package repository has been archived on GitHub')
    }
  }
}

module.exports = Marshall
