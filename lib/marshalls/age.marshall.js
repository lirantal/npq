'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'age'
const PACKAGE_AGE_THRESHOLD = 22 // specified in days

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title() {
    return 'Checking package maturity'
  }

  validate(pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then((data) => {
      if (data && data.time && data.time.created) {
        const pkgCreatedDate = data.time.created
        const dateDiff = Date.now() - Date.parse(pkgCreatedDate)

        if (dateDiff < PACKAGE_AGE_THRESHOLD) {
          throw new Error(
            `detected a newly published package (created < ${PACKAGE_AGE_THRESHOLD} days) act carefully`
          )
        }

        return dateDiff
      } else {
        throw new Error('could not determine package age')
      }
    })
  }
}

module.exports = Marshall
