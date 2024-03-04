'use strict'

const BaseMarshall = require('./baseMarshall')
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

  validate(pkg) {
    let packageData = null
    let ageDateDiff = null
    return this.packageRepoUtils
      .getPackageInfo(pkg.packageName)
      .then((data) => {
        if (data && data.time && data.time.created) {
          packageData = data
          const pkgCreatedDate = data.time.created
          const dateDiff = Date.now() - Date.parse(pkgCreatedDate)

          ageDateDiff = dateDiff
          if (dateDiff < PACKAGE_AGE_THRESHOLD) {
            throw new Error(
              `detected a newly published package (created < ${PACKAGE_AGE_THRESHOLD} days) act carefully`
            )
          }

          return pkg
        } else {
          throw new Error('could not determine package age')
        }
      })
      .then((pkg) => {
        return this.packageRepoUtils.getSemVer(pkg.packageName, pkg.packageVersion)
      })
      .then((versionResolved) => {
        const versionReleaseDate = packageData.time[versionResolved]
        const versionDateDiff = new Date() - new Date(versionReleaseDate)

        const versionDateDiffInDays = Math.round(versionDateDiff / (1000 * 60 * 60 * 24))

        let timeAgoText = 'days'
        let timeAgoNumber = versionDateDiffInDays

        if (versionDateDiffInDays >= 365) {
          timeAgoText = 'years'
          timeAgoNumber = Math.floor(versionDateDiffInDays / 365)
        }

        if (versionDateDiffInDays >= PACKAGE_AGE_UNMAINTAINED_RISK) {
          throw new Error(`detected an old package (created ${timeAgoNumber} ${timeAgoText} ago)`)
        }
      })
  }
}

module.exports = Marshall
