'use strict'

const chalk = require('chalk')
const inquirer = require('inquirer')

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

    return Marshalls.tasks(config).catch(ctx =>
      this.report(ctx.context.marshalls)
    )
  }

  report (marshalls) {
    const errors = this.collectPackageErrors(marshalls)
    console.log()

    if (!errors) {
      return
    }

    console.log(`Detected possible issues with the following packages:`)
    for (const [packageName, packageErrors] of Object.entries(errors)) {
      console.log(`  [${chalk.red(packageName)}]`)

      packageErrors.forEach(errorMessage => {
        console.log(`    - ${errorMessage}`)
      })
    }

    console.log()
    return inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'Would you like to continue installing package(s)?',
        default: false
      }
    ])
  }

  collectPackageErrors (marshalls) {
    const allPackagesErrors = {}
    for (const [key, value] of Object.entries(marshalls)) {
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
    packages.packageName
      ? packages[packageName].concat(packageError)
      : (packages[packageName] = [packageError])
  }
}

module.exports = Marshall
