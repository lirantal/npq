'use strict'

const { parseArgs } = require('node:util')
const npa = require('npm-package-arg')
const pkg = require('../package.json')

class CliParser {
  static _extractPackagesFromPositionals(positionals) {
    let packages = []
    if (positionals.length > 0) {
      const command = positionals[0]

      switch (command) {
        case 'install':
        case 'i':
        case 'add':
        case 'isntall':
        case 'in':
        case 'ins':
        case 'inst':
        case 'insta':
        case 'instal':
        case 'isnt':
        case 'isnta':
        case 'isntal':
          packages = positionals.slice(1)
          break
        default:
          // Treat first positional as package if no explicit command
          packages = positionals
          break
      }
    }

    // Parse and normalize packages
    return packages.map((pkg) => {
      const parsedPackage = npa(pkg)
      const versionModifier = parsedPackage.fetchSpec === '*' ? 'latest' : parsedPackage.fetchSpec
      return `${parsedPackage.name}@${versionModifier}`
    })
  }

  static parseArgsFull() {
    const options = {
      'dry-run': { type: 'boolean' },
      packageManager: { type: 'string' },
      pkgMgr: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' }
    }

    const config = {
      options,
      allowPositionals: true,
      strict: false
    }

    const { values, positionals } = parseArgs(config)

    // Handle help
    if (values.help) {
      console.log(`Usage: npq install <package> [options]

Commands:
  install [package...]  install a package

Options:
      --dry-run           Run checks only, don't install
      --packageManager    Package manager to use (default: npm)
      --pkgMgr            Alias for packageManager
  -h, --help              Show help
  -v, --version           Show version

Examples:
  npq install express

curated by Liran Tal at https://github.com/lirantal/npq`)
      process.exit(0)
    }

    // Handle version
    if (values.version) {
      console.log(pkg.version)
      process.exit(0)
    }

    // Process install command and packages
    const normalizedPackages = this._extractPackagesFromPositionals(positionals)

    return {
      packages: normalizedPackages,
      packageManager: values.packageManager || values.pkgMgr || 'npm',
      dryRun: values['dry-run'] || false
    }
  }

  static parseArgsMinimal() {
    const config = {
      allowPositionals: true,
      strict: false,
      options: {}
    }

    const { positionals } = parseArgs(config)

    const normalizedPackages = this._extractPackagesFromPositionals(positionals)

    return {
      packages: normalizedPackages
    }
  }
}

module.exports.CliParser = CliParser
