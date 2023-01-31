/* eslint-disable indent */
'use strict'

const childProcess = require('child_process')
const DEFAULT_PKGMGR = 'npm'

class packageManager {
  static process (packageManagerOption) {
    const detectedPackageManager = packageManager.validatePackageManager(packageManagerOption)
    return packageManager.spawnPackageManager(detectedPackageManager)
  }

  static spawnPackageManager (packageManager) {
    let args = []

    args = args.concat(process.argv.slice(2)).filter((item) => {
      switch (item) {
        case '--packageManager':
        case '--pkgMgr':
        case '--dry-run':
          return false
        default:
          return true
      }
    })

    const child = childProcess.spawn(packageManager, args, {
      stdio: 'inherit',
      shell: true
    })

    return Promise.resolve(child)
  }

  static validatePackageManager (packageManagerOption) {
    if (!packageManagerOption) {
      packageManagerOption = packageManager.getDefaultPackageManager()
    }

    if (typeof packageManagerOption !== 'string') {
      throw new Error('a packageManager should be specified as a string')
    }

    return packageManagerOption
  }

  static getDefaultPackageManager () {
    return DEFAULT_PKGMGR
  }
}

module.exports = packageManager
