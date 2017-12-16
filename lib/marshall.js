'use strict'

const Marshalls = require('./marshalls')
const PackageRepoUtils = require('./helpers/packageRepoUtils')

class Marshall {
  constructor (options = {}) {
    this.pkgs = options ? options.pkgs : null
    this.packageRepoUtils = new PackageRepoUtils()
  }

  process () {
    // nothing to do? move on
    if (!this.pkgs) {
      return Promise.resolve()
    }

    const config = {
      pkgs: this.pkgs,
      packageRepoUtils: this.packageRepoUtils
    }

    return Marshalls.tasks(config)
  }
}

module.exports = Marshall
