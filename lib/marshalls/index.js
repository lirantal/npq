'use strict'

const fs = require('node:fs')
const path = require('node:path')

class Marshalls {
  static async collectMarshalls() {
    const files = await fs.promises.readdir(__dirname)

    const matchingFiles = files
      .filter((file) => path.matchesGlob(file, this.GLOB_MARSHALLS))
      .map((file) => path.resolve(__dirname, file))

    return matchingFiles
  }

  static async buildMarshallTasks(marshalls, options) {
    if (!marshalls || !Array.isArray(marshalls) || marshalls.length === 0) {
      return Promise.reject(new Error('unable to collect marshalls, or no marshalls found'))
    }

    const config = {
      packageRepoUtils: options.packageRepoUtils
    }

    const marshallTasks = marshalls.reduce((prev, curr) => {
      // eslint-disable-next-line security/detect-non-literal-require
      const Marshall = require(curr)
      const marshall = new Marshall(config)

      return prev.concat({
        title: marshall.title(),
        categoryId: marshall.categoryId,
        execute: async (options) => {
          const ctx = {
            pkgs: options.pkgs,
            marshalls: {}
          }
          marshall.init(ctx)
          await marshall.run(ctx)
          return ctx
        }
      })
    }, [])

    return marshallTasks
  }

  static async tasks(options) {
    const marshallResults = []

    // @TODO handle throw error because fetch didn't work due to network issues
    const packagesDataList = await Marshalls.warmUpPackagesCache(options)

    // handle error in case we get just one package and it is not found
    // if (packagesDataList && packagesDataList.length === 1) {
    //   if (packagesDataList[0].error && packagesDataList[0].error === 'Not found') {
    //   }
    // }

    // handle error in case we get more than one package and at least one is not found
    // in which we case we simply remove the package from the `options` array
    // which lists objects (each have a property of packageName)
    if (packagesDataList && packagesDataList.length > 0) {
      options.pkgs = options.pkgs.filter((pkg, index) => {
        if (packagesDataList[index].error && packagesDataList[index].error === 'Not found') {
          const errorResult = {
            ['not_found']: {
              marshall: 'not_found',
              status: null,
              errors: [{ pkg: options.pkgs[index].packageName, message: 'Package not found' }],
              warnings: [],
              data: {},
              categoryId: 'PackageHealth'
            }
          }

          marshallResults.push(errorResult)
          return false
        }

        return true
      })
    }

    const marshalls = await Marshalls.collectMarshalls()

    const packagesToProcess = options.pkgs
    if (packagesToProcess.length > 0) {
      const marshallTasks = await Marshalls.buildMarshallTasks(marshalls, {
        packageRepoUtils: options.packageRepoUtils
      })

      for (const marshall of marshallTasks) {
        try {
          const res = await marshall.execute({
            pkgs: options.pkgs,
            marshalls: {}
          })
          marshallResults.push(res.marshalls)
        } catch (error) {
          console.error(`Error running task ${marshall.title}:`, error)
        }
      }
    }

    return marshallResults

    // .catch((err) => {
    //   // console.error('Error:', err.message)
    //   // avoid implementing a custom error message for a not found package
    //   // because the package manager will yield its own error message
    //   return { error: true, message: err.message }
    // })
  }

  static warmUpPackagesCache(options) {
    const fetchPackagesInfoPromises = []
    options.pkgs.forEach((packageMeta) => {
      fetchPackagesInfoPromises.push(
        options.packageRepoUtils.getPackageInfo(packageMeta.packageName)
      )
    })

    return Promise.all(fetchPackagesInfoPromises)
  }
}

Marshalls.GLOB_MARSHALLS = '*.marshall.js'

module.exports = Marshalls
