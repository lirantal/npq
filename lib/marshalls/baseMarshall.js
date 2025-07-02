'use strict'

const util = require('node:util')
const Warning = require('../helpers/warning')
const { marshallCategories } = require('./constants')

class BaseMarshall {
  constructor(options) {
    this.debug = util.debuglog('npq')
    this.packageRepoUtils = options.packageRepoUtils
    this.categoryId = marshallCategories.PackageHealth.id
  }

  init(ctx) {
    this.ctx = ctx

    ctx.marshalls[this.name] = {
      status: null,
      errors: [],
      warnings: [],
      data: {},
      marshall: this.name,
      categoryId: this.categoryId
    }
  }

  run(ctx) {
    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.checkPackage(currPkg, ctx))
    }, [])

    return Promise.all(tasks)
  }

  checkPackage(pkg, ctx) {
    return this.validate(pkg)
      .then((data) => {
        ctx.marshalls[this.name].data[pkg.packageString] = data

        // not explicitly required, but a task can return its results
        return data
      })
      .catch((err) => {
        this.setMessage(
          {
            pkg: pkg.packageString,
            message: err.message
          },
          Boolean(err instanceof Warning)
        )
      })
  }

  isEnabled() {
    const isMarshallSilent = process.env[`MARSHALL_DISABLE_${this.name.toUpperCase()}`] || false

    return !isMarshallSilent
  }

  setMessage(msg, isWarning) {
    const messages = isWarning
      ? this.ctx.marshalls[this.name].warnings
      : this.ctx.marshalls[this.name].errors

    messages.push({
      pkg: msg.pkg,
      message: msg.message
    })
  }
}

module.exports = BaseMarshall
