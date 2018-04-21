'use strict'

const BaseMarshall = require('./baseMarshall')
const emailValidator = require('email-validator')

const MARSHALL_NAME = 'author'

class Marshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Identifying package author...'
  }

  validate (pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then(data => {
      const hasAuthorEmail =
        (data.author && data.author.email && emailValidator.validate(data.author.email)) ||
        (data.authors && data.authors.filter && data.authors.filter(author => emailValidator.validate(data.email)))

      if (!hasAuthorEmail) {
        return {
          isWarning: true,
          message: `the package description has no author(s). Proceed with care.`
        }
      }

      return data
    })
  }
}

module.exports = Marshall
