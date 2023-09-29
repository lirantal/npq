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
    return Marshalls.warmUpPackagesCache(options)
      .then(() => Marshalls.collectMarshalls())
      .then((marshalls) => {
        return Marshalls.buildMarshallTasks(marshalls, {
          packageRepoUtils: options.packageRepoUtils
        })
      })
      .then((tasks) => {
        return Marshalls.runTasks(tasks, options)
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
