'use strict'

const crossSpawn = require('cross-spawn')
const LINE_BREAK_PATTERN = /[\r\n]/
const DEFAULT_PKGMGR = 'npm'

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
          return false
        default:
          return true
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
    return {
      executable: packageManagerOption,
      args
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
