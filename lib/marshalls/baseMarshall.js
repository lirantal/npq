'use strict'

const semver = require('semver')
const util = require('node:util')
const NotEvaluated = require('../helpers/notEvaluated')
const { RegistryError } = require('../helpers/registryErrors')
const Warning = require('../helpers/warning')
const { marshallCategories } = require('./constants')

class BaseMarshall {
  constructor(options) {
    this.debug = util.debuglog('npq')
    this.packageRepoUtils = options.packageRepoUtils
    this.registryClient = options.registryClient
    this.categoryId = marshallCategories.PackageHealth.id
  }

  init(ctx) {
    this.ctx = ctx

    ctx.marshalls[this.name] = {
      status: null,
      errors: [],
      warnings: [],
      notEvaluated: [],
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
        if (err instanceof RegistryError) {
          throw err
        }

        const message = {
          pkg: pkg.packageString,
          message: err.message
        }

        if (err instanceof NotEvaluated) {
          this.setNotEvaluated(message)
          return undefined
        }

        this.setMessage(message, Boolean(err instanceof Warning))
        return undefined
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

  setNotEvaluated(msg) {
    this.ctx.marshalls[this.name].notEvaluated.push({
      pkg: msg.pkg,
      message: msg.message
    })
  }

  /**
   * Resolves a package version string to an actual semver version
   * Handles dist-tags (latest, beta, etc.) and direct semver versions
   * @param {string} packageName - The package name
   * @param {string} versionSpec - The version specification (could be dist-tag or semver)
   * @param {Object} packageData - Optional package data to avoid re-fetching
   * @returns {Promise<string|null>} - The resolved semver version or null if not found
   */

  async resolvePackageVersion(packageName, versionSpec, packageData) {
    if (typeof versionSpec !== 'string' || versionSpec.trim() === '') return null
    const data = packageData || (await this.packageRepoUtils.getPackageInfo(packageName))

    if (!data) return null

    // Handle dist-tags first
    if (data['dist-tags'] && data['dist-tags'][versionSpec]) {
      return data['dist-tags'][versionSpec]
    }

    // Handle semver ranges and exact versions using all available versions
    if (data.versions) {
      const availableVersions = Object.keys(data.versions)
      const resolved = semver.maxSatisfying(availableVersions, versionSpec)
      if (resolved) return resolved
    }

    // Fallback for simple parsing if range resolution fails
    const parsed = this.packageRepoUtils.parsePackageVersion(versionSpec)
    return parsed ? parsed.version : null
  }
}

module.exports = BaseMarshall
