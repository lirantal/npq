'use strict'

const { parseArgs } = require('node:util')
const npa = require('npm-package-arg')
const pkg = require('../package.json')

const INSTALL_SUBCOMMANDS = new Set([
  'install',
  'i',
  'add',
  'isntall',
  'in',
  'ins',
  'inst',
  'insta',
  'instal',
  'isnt',
  'isnta',
  'isntal'
])

class CliParser {
  static isInstallSubcommand(token) {
    return INSTALL_SUBCOMMANDS.has(token)
  }
  static exit({ errorCode, message, spinner }) {
    if (spinner && spinner.isSpinning) {
      spinner.stop()
    }

    if (message) {
      console.error('\n')
      console.error(message)
    }

    // Ensure errorCode is always a number
    const exitCode = typeof errorCode === 'number' ? errorCode : -1
    process.exit(exitCode)
  }

  static _extractPackagesFromPositionals(positionals, earlyExitNoInstall = false) {
    let packages = []
    if (positionals.length > 0) {
      const command = positionals[0]

      if (this.isInstallSubcommand(command)) {
        packages = positionals.slice(1)
      } else if (!earlyExitNoInstall) {
        // Treat first positional as package if no explicit command
        packages = positionals
      }
      // earlyExitNoInstall + non-install: packages stay [] (npq-hero)
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
      plain: { type: 'boolean' },
      packageManager: { type: 'string' },
      pkgMgr: { type: 'string' },
      'disable-auto-continue': { type: 'boolean' },
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
  install [package...]  install a package (required to run the package manager)

  With no install subcommand, npq audits packages only (current project deps from
  package.json, or package names you pass) and does not invoke npm install.

Options:
      --dry-run               Run checks only, don't install
      --plain                 Force non-rich text output
      --packageManager        Package Manager to use (default: npm)
      --pkgMgr                Alias for packageManager
      --disable-auto-continue Disable auto-continue countdown, always prompt
  -h, --help                  Show help
  -v, --version               Show version

Environment Variables:
  NPQ_PKG_MGR                 Package manager to use; overrides --packageManager when set (default: npm)
  NPQ_DISABLE_AUTO_CONTINUE   Set to 'true' to disable auto-continue

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
    const installSubcommandExplicit =
      positionals.length > 0 && this.isInstallSubcommand(positionals[0])

    return {
      packages: normalizedPackages,
      packageManager: process.env.NPQ_PKG_MGR || values.packageManager || values.pkgMgr || 'npm',
      dryRun: values['dry-run'] || false,
      plain: values.plain || false,
      disableAutoContinue:
        values['disable-auto-continue'] || process.env.NPQ_DISABLE_AUTO_CONTINUE === 'true',
      installSubcommandExplicit
    }
  }

  static parseArgsMinimal() {
    const config = {
      allowPositionals: true,
      strict: false,
      options: {
        install: {
          type: 'string',
          short: 'i',
          default: 'install'
        }
      }
    }

    const { positionals } = parseArgs(config)

    const earlyExitNoInstall = true
    const normalizedPackages = this._extractPackagesFromPositionals(positionals, earlyExitNoInstall)

    return {
      packages: normalizedPackages
    }
  }
}

module.exports.CliParser = CliParser
