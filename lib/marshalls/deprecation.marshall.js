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

  async validate(pkg) {
    const data = await this.packageRepoUtils.getPackageInfo(pkg.packageName)

    if (!data) {
      return true
    }

    const packageVersion = await this.resolvePackageVersion(
      pkg.packageName,
      pkg.packageVersion,
      data
    )

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
  }
}

module.exports = Marshall
