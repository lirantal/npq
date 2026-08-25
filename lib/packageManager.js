'use strict'

const crossSpawn = require('cross-spawn')
const LINE_BREAK_PATTERN = /[\r\n]/
const WINDOWS_COMMAND_SHIM_META_CHARS = /([()\][!^"`<>&|;, *?])/g
const DEFAULT_PKGMGR = 'npm'

function escapeWindowsCommandShimArgument(argument) {
  return `${argument}`
    .replace(WINDOWS_COMMAND_SHIM_META_CHARS, '^$1')
    .replace(WINDOWS_COMMAND_SHIM_META_CHARS, '^$1')
}

class packageManager {
  static process(packageManagerOption) {
    const detectedPackageManager = packageManager.validatePackageManager(packageManagerOption)
    return packageManager.spawnPackageManager(detectedPackageManager)
  }

  static spawnPackageManager(packageManagerOption) {
    const args = process.argv.slice(2).filter((item) => {
      switch (item) {
        case '--packageManager':
        case '--pkgMgr':
        case '--dry-run':
        case '--allow-non-interactive-install':
          return false
        default:
          return !item.startsWith('--allow-non-interactive-install=')
      }
    })

    if (args.some((item) => LINE_BREAK_PATTERN.test(item))) {
      return Promise.reject(new Error('package manager arguments cannot contain line breaks'))
    }

    const { executable, args: launchArgs } = packageManager.getPackageManagerLaunchSpec(
      packageManagerOption,
      args
    )

    const child = crossSpawn.spawn(executable, launchArgs, {
      stdio: 'inherit',
      shell: false
    })

    return new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
  }

  static getPackageManagerLaunchSpec(packageManagerOption, args) {
    // Batch shims expand %* into another command line, so preserve escaping
    // through that second cmd.exe parse when cross-spawn routes through it.
    const parsed = crossSpawn._parse(packageManagerOption, [], { shell: false })
    const windowsCommandInterpreter = process.env.comspec || 'cmd.exe'
    const usesWindowsCommandShim =
      process.platform === 'win32' &&
      parsed.command.toLowerCase() === windowsCommandInterpreter.toLowerCase()

    return {
      executable: packageManagerOption,
      args: usesWindowsCommandShim ? args.map(escapeWindowsCommandShimArgument) : args
    }
  }

  static validatePackageManager(packageManagerOption) {
    if (!packageManagerOption) {
      packageManagerOption = packageManager.getDefaultPackageManager()
    }

    if (typeof packageManagerOption !== 'string') {
      throw new Error('a packageManager should be specified as a string')
    }

    if (LINE_BREAK_PATTERN.test(packageManagerOption)) {
      throw new Error('a packageManager should not contain line breaks')
    }

    return packageManagerOption
  }

  static getDefaultPackageManager() {
    return DEFAULT_PKGMGR
  }
}

module.exports = packageManager
