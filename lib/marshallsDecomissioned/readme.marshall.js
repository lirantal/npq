'use strict'

const BaseMarshall = require('../marshalls/baseMarshall')
const { marshallCategories } = require('../marshalls/constants')

const MARSHALL_NAME = 'readme'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
  }

  title() {
    return 'Checking availability of a README'
  }

  validate(pkg) {
    return this.packageRepoUtils.getReadmeInfo(pkg.packageName).then((readmeContents) => {
      if (!readmeContents || readmeContents === 'ERROR: No README data found!') {
        throw new Error('Package has no README file available')
      }

      if (readmeContents.indexOf('# Security holding package') === 0) {
        throw new Error('Package flagged for security issues and served as place-holder')
      }

      return readmeContents
    })
  }
}

module.exports = Marshall
