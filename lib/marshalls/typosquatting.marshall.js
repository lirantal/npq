'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')

const path = require('path')
const { levenshteinDistance } = require('../helpers/levenshteinDistance')
const topPackagesRawJSON = require(path.join(__dirname, '../../data/top-packages.json'))
const topPackages = new Set(topPackagesRawJSON)

const MARSHALL_NAME = 'typosquatting'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
  }

  title() {
    return 'Checking for typosquatting'
  }

  validate(pkg) {
    let editDistance = null
    let similarPackages = []
    return new Promise((resolve, reject) => {
      // If package is within an allow-list
      if (this.packageRepoUtils.isPackageInAllowList(pkg.packageName)) {
        return resolve([])
      }

      // If the package to be installed is itself found within the Top Packages dataset
      // then we don't report on it
      if (topPackages.has(pkg.packageName)) {
        return resolve([])
      }

      for (const popularPackageNameInRepository of topPackagesRawJSON) {
        editDistance = levenshteinDistance(pkg.packageName, popularPackageNameInRepository)

        if (editDistance > 0 && editDistance < 3) {
          similarPackages.push(popularPackageNameInRepository)
        }
      }

      if (similarPackages.length > 0) {
        // Remove duplicates from similarPackages array
        const uniqueSimilarPackages = [...new Set(similarPackages)]
        return reject(
          new Error(
            `Potential typosquatting with popular package(s): ${uniqueSimilarPackages.join(', ')}`
          )
        )
      }

      return resolve([])
    })
  }
}

module.exports = Marshall
