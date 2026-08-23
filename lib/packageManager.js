'use strict'

const crossSpawn = require('cross-spawn')
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

    return packageManagerOption
  }

  static getDefaultPackageManager() {
    return DEFAULT_PKGMGR
  }
}

module.exports = packageManager
