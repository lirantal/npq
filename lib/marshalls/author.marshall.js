'use strict'

const BaseMarshall = require('./baseMarshall')
const validator = require('validator')
const Warning = require('../helpers/warning')

const MARSHALL_NAME = 'author'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title() {
    return 'Identifying package author...'
  }

  validate(pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then((data) => {
      const lastVersionData =
        data.versions && data['dist-tags'] && data.versions[data['dist-tags'].latest]

      const hasAuthorEmail =
        (lastVersionData &&
          lastVersionData.author &&
          lastVersionData.author.email &&
          validator.isEmail(lastVersionData.author.email)) ||
        (data.versions &&
          lastVersionData &&
          lastVersionData.authors &&
          lastVersionData.authors.filter &&
          lastVersionData.authors.filter(
            (author) => author.email && validator.isEmail(author.email).length
          ))

      if (!hasAuthorEmail) {
        throw new Warning(
          'the package description has no e-mail associated with author(s). Proceed with care.'
        )
      }

      return data
    })
  }
}

module.exports = Marshall
