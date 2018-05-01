'use strict'

const chalk = require('chalk')

const Marshalls = require('./marshalls')
const PackageRepoUtils = require('./helpers/packageRepoUtils')

const MESSAGE_TYPE = {
  ERROR: 0,
  WARNING: 1
}

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
    const messages = this.collectPackageMessages(marshalls)

    if (!messages) {
      return { error: false }
    }

    console.log(`Detected possible issues with the following packages:`)
    for (const [packageName, packageMessages] of Object.entries(messages)) {
      console.log(`  [${chalk.red(packageName)}]`)

      packageMessages.forEach(message => {
        if (message.type === MESSAGE_TYPE.ERROR) {
          console.log(`    - ${chalk.red(message.text)}`)
        } else {
          console.log(`    - ${chalk.yellow(message.text)}`)
        }
      })
    }

    return { error: true, data: messages }
  }

  collectPackageMessages (marshalls) {
    const allPackageMessages = {}
    for (const [key] of Object.entries(marshalls)) {
      this.prepareMessages(allPackageMessages, marshalls[key].errors)
      this.prepareMessages(allPackageMessages, marshalls[key].warnings, true)
    }

    return allPackageMessages
  }

  prepareMessages (allPackageMessages, messages, isWarning) {
    if (Array.isArray(messages) && messages.length > 0) {
      messages.forEach(msg => {
        this.appendPackageMessage(
          allPackageMessages,
          msg.pkg,
          {
            text: msg.message,
            type: isWarning ? MESSAGE_TYPE.WARNING : MESSAGE_TYPE.ERROR
          }
        )
      })
    }
  }

  appendPackageMessage (packages, packageName, packageMessage) {
    packages[packageName]
      ? packages[packageName].push(packageMessage)
      : (packages[packageName] = [packageMessage])
  }
}

module.exports = Marshall
