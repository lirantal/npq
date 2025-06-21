'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'version_maturity'
const VERSION_AGE_THRESHOLD = 7 // specified in days

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
  }

  title() {
    return 'Checking version maturity'
  }

  validate(pkg) {
    let packageData = null
    return this.packageRepoUtils
      .getPackageInfo(pkg.packageName)
      .then((data) => {
        if (data && data.time) {
          packageData = data
          return pkg
        } else {
          throw new Error('could not determine package version information')
        }
      })
      .then((pkg) => {
        return this.packageRepoUtils.getSemVer(pkg.packageName, pkg.packageVersion)
      })
      .then((versionResolved) => {
        const versionReleaseDate = packageData.time[versionResolved]

        if (!versionReleaseDate) {
          throw new Error(`could not determine release date for version ${versionResolved}`)
        }

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
            `detected a recently published version (published ${timeAgoNumber} ${timeAgoText} ago) - consider waiting for community review`
          )
        }

        return pkg
      })
  }
}

module.exports = Marshall
