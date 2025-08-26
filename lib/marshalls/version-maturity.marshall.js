'use strict'

const BaseMarshall = require('./baseMarshall')
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
    const versionDateDiff = new Date() - new Date(versionReleaseDate)
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

      throw new Error(
        `Detected a recently published version (published ${timeAgoNumber} ${timeAgoText} ago) - consider waiting for community review`
      )
    }

    return pkg
  }
}

module.exports = Marshall
