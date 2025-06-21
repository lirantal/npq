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
    let packageFoundInTopPackages = false
    return new Promise((resolve, reject) => {
      for (const popularPackageNameInRepository of topPackagesRawJSON) {
        // If the package to be installed is itself found within the Top Packages dataset
        // then we don't report on it
        if (pkg.packageName === popularPackageNameInRepository) {
          packageFoundInTopPackages = true
          return resolve([])
        }

        levenshteinDistance = levenshtein.get(pkg.packageName, popularPackageNameInRepository)

        if (levenshteinDistance > 0 && levenshteinDistance < 3) {
          similarPackages.push(popularPackageNameInRepository)
        }
      }

      if (similarPackages.length > 0) {
        // Remove duplicates from similarPackages array
        const uniqueSimilarPackages = [...new Set(similarPackages)]
        return reject(
          new Error(
            `Package name could be a typosquatting attempt for popular package(s): ${uniqueSimilarPackages.join(
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
