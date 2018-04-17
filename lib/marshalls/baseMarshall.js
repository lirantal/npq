'use strict'

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
    .then(data => {
      task.output = `querying ${pkg.packageString}...`
      ctx.marshalls[this.name].data[pkg.packageString] = data

      // not explicitly required, but a task can return its results
      return data
    })
    .catch(err => {
      this.setError({
        pkg: pkg.packageString,
        message: err.message
      })
    })
  }

  isEnabled (ctx) {
    const isMarshallSilent =
    process.env[`MARSHALL_DISABLE_${this.name.toUpperCase()}`] || false

    return !isMarshallSilent
  }

  setError (error) {
    this.ctx.marshalls[this.name].errors.push({
      pkg: error.pkg,
      message: error.message
    })
  }

  handleErrors () {
    const errors = this.ctx.marshalls[this.name].errors
    if (errors && errors.length) {
      throw new Error()
    }

    return Promise.resolve()
  }
}

module.exports = BaseMarshall
