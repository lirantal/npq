'use strict'

const BaseMarshall = require('./baseMarshall')
const Warning = require('../helpers/warning')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'age'
const PACKAGE_AGE_THRESHOLD = 22 // specified in days
const PACKAGE_AGE_UNMAINTAINED_RISK = 365 // specified in days

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
  }

  title() {
    return 'Checking package maturity'
  }

  async validate(pkg) {
    const data = await this.packageRepoUtils.getPackageInfo(pkg.packageName)

    if (!data || !data.time || !data.time.created) {
      throw new Warning('Could not determine package age')
    }

    const pkgCreatedDate = data.time.created
    const dateDiff = Date.now() - Date.parse(pkgCreatedDate)
    const thresholdMs = PACKAGE_AGE_THRESHOLD * 24 * 60 * 60 * 1000

    if (dateDiff < thresholdMs) {
      throw new Error(
        `Detected a newly published package (created < ${PACKAGE_AGE_THRESHOLD} days) act carefully`
      )
    }

    const packageVersion = await this.resolvePackageVersion(
      pkg.packageName,
      pkg.packageVersion,
      data
    )

    if (!packageVersion || !data.time[packageVersion]) {
      throw new Warning('Could not determine package version release date')
    }

    const versionReleaseDate = data.time[packageVersion]
    const versionDateDiff = Date.now() - Date.parse(versionReleaseDate)
    const versionDateDiffInDays = Math.round(versionDateDiff / (1000 * 60 * 60 * 24))
    const unmaintainedThresholdMs = PACKAGE_AGE_UNMAINTAINED_RISK * 24 * 60 * 60 * 1000

    let timeAgoText = 'days'
    let timeAgoNumber = versionDateDiffInDays

    if (versionDateDiffInDays >= 365) {
      timeAgoText = 'years'
      timeAgoNumber = Math.floor(versionDateDiffInDays / 365)
    }

    if (versionDateDiff >= unmaintainedThresholdMs) {
      throw new Warning(`Detected an old package (created ${timeAgoNumber} ${timeAgoText} ago)`)
    }
  }
}

module.exports = Marshall
