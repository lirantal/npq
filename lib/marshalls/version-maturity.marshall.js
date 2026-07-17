'use strict'

const BaseMarshall = require('./baseMarshall')
const { findAlternativeVersion } = require('../helpers/versionAge')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'version_maturity'
const VERSION_AGE_THRESHOLD = 7 // specified in days

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.SupplyChainSecurity.id
  }

  title() {
    return 'Checking version maturity'
  }

  async validate(pkg) {
    const data = await this.packageRepoUtils.getPackageInfo(pkg.packageName)

    if (!data || !data.time) {
      throw new Error('Could not determine package version information')
    }

    const packageVersion = await this.resolvePackageVersion(
      pkg.packageName,
      pkg.packageVersion,
      data
    )

    if (!packageVersion || !Object.prototype.hasOwnProperty.call(data.time, packageVersion)) {
      throw new Error(`Could not determine release date for version ${packageVersion}`)
    }

    const versionReleaseDate = data.time[packageVersion]
    const now = Date.now()
    const versionDateDiff = now - new Date(versionReleaseDate)
    const versionDateDiffInDays = Math.round(versionDateDiff / (1000 * 60 * 60 * 24))

    if (versionDateDiffInDays < VERSION_AGE_THRESHOLD) {
      let timeAgoText = 'days'
      let timeAgoNumber = versionDateDiffInDays

      if (versionDateDiffInDays === 0) {
        timeAgoText = 'hours'
        const versionDateDiffInHours = Math.round(versionDateDiff / (1000 * 60 * 60))
        timeAgoNumber = versionDateDiffInHours
      } else if (versionDateDiffInDays === 1) {
        timeAgoText = 'day'
      }

      const error = new Error(
        `Detected a recently published version: published ${timeAgoNumber} ${timeAgoText} ago. Consider waiting for community review.`
      )
      const alternative = findAlternativeVersion({
        packageInfo: data,
        targetVersion: packageVersion,
        requestedVersion: pkg.packageVersion,
        now
      })

      if (alternative) {
        error.suggestion = {
          type: 'alternative-version',
          packageName: pkg.packageName,
          version: alternative.version,
          packageSpec: `${pkg.packageName}@${alternative.version}`,
          publishedAt: alternative.publishedAt,
          ageDays: alternative.ageDays,
          reason: 'version-recency'
        }
      }

      throw error
    }

    return pkg
  }
}

module.exports = Marshall
