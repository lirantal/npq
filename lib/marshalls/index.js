'use strict'

const { Listr } = require('listr2')
const { glob } = require('glob')
const { marshallCategories } = require('./constants')

class Marshalls {
  static async collectMarshalls() {
    const files = await glob(this.GLOB_MARSHALLS, {
      cwd: __dirname,
      absolute: true
    })

    return files
  }

  static async buildMarshallTasks(marshalls, config) {
    if (!marshalls || !Array.isArray(marshalls) || marshalls.length === 0) {
      return Promise.reject(new Error('unable to collect marshalls, or no marshalls found'))
    }

    const marshallTasks = marshalls.reduce((prev, curr) => {
      // eslint-disable-next-line security/detect-non-literal-require
      const Marshall = require(curr)
      const marshall = new Marshall(config)

      return prev.concat({
        title: marshall.title(),
        categoryId: marshall.categoryId,
        enabled: (ctx) => marshall.isEnabled(ctx),
        task: async (ctx, task) => {
          marshall.init(ctx, task)
          await marshall.run(ctx, task)
          const messages = marshall.handleMessages()
          return messages
        }
      })
    }, [])

    const allMarshallTasksByCategories = Object.keys(marshallCategories).map((categoryId) => {
      const category = marshallCategories[categoryId]
      const filteredMarshallTasks = marshallTasks.filter((marshall) => {
        return marshall.categoryId === category.id
      })

      const marshallsInCategory = {
        title: category.title,
        enabled: true,
        task: () => {
          return new Listr(filteredMarshallTasks, {
            exitOnError: false,
            concurrent: true,
            rendererOptions: { collapseSubtasks: false }
          })
        }
      }
      return marshallsInCategory
    })

    return new Listr(allMarshallTasksByCategories, {
      exitOnError: false,
      concurrent: true,
      rendererOptions: { collapseSubtasks: false }
    })
  }

  static tasks(options) {
    // console.log(options);
    // process.exit(1);
    return Marshalls.warmUpPackagesCache(options)
      .then((packagesDataList) => {
        // handle error in case we get just one package and it is not found
        if (packagesDataList && packagesDataList.length === 1) {
          if (packagesDataList[0].error && packagesDataList[0].error === 'Not found') {
            throw new Error(`Package not found: ${options.pkgs[0].packageName}`)
          }
        }

        // handle error in case we get more than one package and at least one is not found
        // in which we case we simply remove the package from the `options` array
        // which lists objects (each have a property of packageName)
        if (packagesDataList && packagesDataList.length > 1) {
          options.pkgs = options.pkgs.filter((pkg, index) => {
            return !packagesDataList[index].error || packagesDataList[index].error !== 'Not found'
          })
        }
      })
      .then(() => Marshalls.collectMarshalls())
      .then((marshalls) => {
        return Marshalls.buildMarshallTasks(marshalls, {
          packageRepoUtils: options.packageRepoUtils
        })
      })
      .then((tasks) => {
        return Marshalls.runTasks(tasks, options)
      })
      .catch((err) => {
        // console.error('Error:', err.message)
        // avoid implementing a custom error message for a not found package
        // because the package manager will yield its own error message
        return { error: true, message: err.message }
      })
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

  static runTasks(tasks, options) {
    return tasks.run({
      pkgs: options.pkgs,
      marshalls: {}
    })
  }
}

Marshalls.GLOB_MARSHALLS = '*.marshall.js'

module.exports = Marshalls
