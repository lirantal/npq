/* eslint-disable indent */
'use strict'

const childProcess = require('child_process')
const DEFAULT_PKGMGR = 'npm'

class packageManager {
  static process (packageManager) {
    packageManager = this.validatePackageManager(packageManager)
    return this.spawnPackageManager(packageManager)
  }

  static spawnPackageManager (packageManager) {
    let args = []

    args = args.concat(process.argv.slice(2)).filter(item => {
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

  static validatePackageManager (packageManager) {
    if (!packageManager) {
      packageManager = this.getDefaultPackageManager()
    }

    if (typeof packageManager !== 'string') {
      throw new Error('a packageManager should be specified as a string')
    }

    return packageManager
  }

  static getDefaultPackageManager () {
    return DEFAULT_PKGMGR
  }
}

module.exports = packageManager
