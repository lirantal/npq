'use strict'

const Warning = require('../helpers/warning')

class BaseMarshall {
  constructor (options) {
    this.packageRepoUtils = options.packageRepoUtils
  }

  init (ctx, task) {
    this.ctx = ctx
    this.task = task

    ctx.marshalls[this.name] = {
      status: null,
      errors: [],
      warnings: [],
      data: {}
    }
  }

  run (ctx, task) {
    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.checkPackage(currPkg, ctx, task))
    }, [])

    return Promise.all(tasks)
  }

  checkPackage (pkg, ctx, task) {
    return this.validate(pkg)
      .then((data) => {
        task.output = `querying ${pkg.packageString}...`
        ctx.marshalls[this.name].data[pkg.packageString] = data

        // not explicitly required, but a task can return its results
        return data
      })
      .catch((err) => {
        if (err instanceof Warning) {
          this.setMessage(
            {
              pkg: pkg.packageString,
              message: err.message
            },
            true
          )
        } else {
          this.setMessage({
            pkg: pkg.packageString,
            message: err.message
          })
        }
      })
  }

  isEnabled () {
    const isMarshallSilent = process.env[`MARSHALL_DISABLE_${this.name.toUpperCase()}`] || false

    return !isMarshallSilent
  }

  setMessage (msg, isWarning) {
    const messages = isWarning
      ? this.ctx.marshalls[this.name].warnings
      : this.ctx.marshalls[this.name].errors

    messages.push({
      pkg: msg.pkg,
      message: msg.message
    })
  }

  handleMessages () {
    const errors = this.ctx.marshalls[this.name].errors
    const warnings = this.ctx.marshalls[this.name].warnings
    if ((errors && errors.length) || (warnings && warnings.length)) {
      throw new Error()
    }

    return Promise.resolve()
  }
}

module.exports = BaseMarshall
