'use strict'

const chalk = require('chalk')

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
      pkgs: this.createPackageVersionMaps(this.pkgs),
      packageRepoUtils: this.packageRepoUtils
    }

    return Marshalls.tasks(config).catch(ctx => {
      if (ctx && ctx.context && ctx.context.marshalls) {
        return this.report(ctx.context.marshalls)
      }

      throw ctx
    })
  }

  createPackageVersionMaps (packages) {
    const packageVersionMapping = packages.reduce((prev, curr) => {
      const versionSymbolPosition = curr.lastIndexOf('@')
      const versionPosition = versionSymbolPosition === -1 ||
        versionSymbolPosition === 0
        ? curr.length
        : versionSymbolPosition

      prev.push({
        packageName: curr.substr(0, versionPosition),
        packageVersion: curr.substr(versionPosition + 1) || 'latest',
        packageString: curr
      })

      return prev
    }, [])

    return packageVersionMapping
  }

  report (marshalls) {
    const errors = this.collectPackageErrors(marshalls)
    console.log()

    if (!errors) {
      return { error: false }
    }

    console.log(`Detected possible issues with the following packages:`)
    for (const [packageName, packageErrors] of Object.entries(errors)) {
      console.log(`  [${chalk.red(packageName)}]`)

      packageErrors.forEach(errorMessage => {
        console.log(`    - ${errorMessage}`)
      })
    }

    return { error: true, data: errors }
  }

  collectPackageErrors (marshalls) {
    const allPackagesErrors = {}
    for (const [key] of Object.entries(marshalls)) {
      const errors = marshalls[key].errors
      if (Array.isArray(errors) && errors.length > 0) {
        errors.forEach(error => {
          this.appendPackageError(
            allPackagesErrors,
            error['pkg'],
            error['message']
          )
        })
      }
    }

    return allPackagesErrors
  }

  appendPackageError (packages, packageName, packageError) {
    packages[packageName]
      ? packages[packageName].push(packageError)
      : (packages[packageName] = [packageError])
  }
}

module.exports = Marshall
