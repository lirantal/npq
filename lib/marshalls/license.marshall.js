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
      .getReadmeInfo(pkg.packageName)
      .then(readmeContents => {
        if (
          !readmeContents ||
          readmeContents === 'ERROR: No README data found!'
        ) {
          throw new Error(`package has no README file available`)
        }

        if (
          readmeContents &&
          readmeContents.indexOf('# Security holding package') === 0
        ) {
          throw new Error(
            'package flagged for security issues and served as place-holder'
          )
        }

        return readmeContents
      })
  }
}

module.exports = Marshall
