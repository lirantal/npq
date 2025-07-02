'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'deprecation'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
  }

  title() {
    return 'Checking package for deprecation flag'
  }

  validate(pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then((data) => {
      const packageVersion =
        pkg.packageVersion === 'latest'
          ? data['dist-tags'] && data['dist-tags'].latest
          : this.packageRepoUtils.parsePackageVersion(pkg.packageVersion).version

      if (!packageVersion) {
        return true
      }

      const packageDeprecated =
        data &&
        data.versions &&
        data.versions[packageVersion] &&
        data.versions[packageVersion].deprecated

      if (packageDeprecated) {
        throw new Error(`Package deprecated: ${packageDeprecated}`)
      }
    })
  }
}

module.exports = Marshall
