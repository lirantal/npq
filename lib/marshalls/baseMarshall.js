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

  isEnabled (ctx) {
    return true
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
  }
}

module.exports = BaseMarshall
