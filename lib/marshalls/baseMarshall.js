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
