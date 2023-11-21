'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')

const path = require('path')
const levenshtein = require('fast-levenshtein')
const topPackagesRawJSON = require(path.join(__dirname, '../../data/top-packages.json'))

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
    let levenshteinDistance = null
    let similarPackages = []
    return new Promise((resolve, reject) => {
      for (const popularPackageNameInRepository of topPackagesRawJSON) {
        levenshteinDistance = levenshtein.get(pkg.packageName, popularPackageNameInRepository)

        if (levenshteinDistance > 0 && levenshteinDistance < 3) {
          similarPackages.push(popularPackageNameInRepository)
        }
      }

      if (similarPackages.length > 0) {
        return reject(
          new Error(
            `Package name could be a typosquatting attempt for popular package(s): ${similarPackages.join(
              ', '
            )}`
          )
        )
      }

      return resolve([])
    })
  }
}

module.exports = Marshall
