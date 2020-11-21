'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'license'

class Marshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Checking availability of a LICENSE'
  }

  validate (pkg) {
    return this.packageRepoUtils
      .getLicenseInfo(pkg.packageName)
      .then(licenseContents => {
        if (
          !licenseContents ||
          licenseContents === 'ERROR: No LICENSE data found!'
        ) {
          throw new Error('package has no LICENSE file available')
        }

        if (
          licenseContents &&
          licenseContents.indexOf('# Security holding package') === 0
        ) {
          throw new Error(
            'package flagged for security issues and served as place-holder'
          )
        }

        return licenseContents
      })
  }
}

module.exports = Marshall
