'use strict'

const Listr = require('listr')
const glob = require('glob')

class Marshalls {
  static collectMarshalls () {
    return new Promise((resolve, reject) => {
      glob(
        this.GLOB_MARSHALLS,
        {
          cwd: __dirname,
          absolute: true
        },
        (err, files) => {
          if (err) {
            reject(err)
          }

          resolve(files)
        }
      )
    })
  }

  static buildMarshallTasks (marshalls, config) {
    if (!marshalls || !Array.isArray(marshalls) || marshalls.length === 0) {
      return Promise.reject(
        new Error('unable to collect marshalls, or no marshalls found')
      )
    }

    const marshallTasks = marshalls.reduce((prev, curr) => {
      const Marshall = require(curr)
      const marshall = new Marshall(config)

      return prev.concat({
        title: marshall.title(),
        enabled: ctx => marshall.isEnabled(ctx),
        task: (ctx, task) => {
          marshall.init(ctx, task)
          return marshall.run(ctx, task).then(() => marshall.handleMessages())
        }
      })
    }, [])

    return new Listr(marshallTasks, { exitOnError: false, concurrent: true })
  }

  static tasks (options) {
    return this.collectMarshalls()
      .then(marshalls => {
        return this.buildMarshallTasks(marshalls, {
          packageRepoUtils: options.packageRepoUtils
        })
      })
      .then(tasks => {
        return this.runTasks(tasks, options)
      })
  }

  static runTasks (tasks, options) {
    return tasks.run({
      pkgs: options.pkgs,
      marshalls: {}
    })
  }
}

Marshalls.GLOB_MARSHALLS = '*.marshall.js'

module.exports = Marshalls
