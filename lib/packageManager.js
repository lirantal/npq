'use strict'

const childProcess = require('child_process')
const DEFAULT_PKGMGR = 'npm'

class packageManager {
  static async process (packageManager) {
    packageManager = this.validatePackageManager(packageManager)
    return this.spawnPackageManager(packageManager)
  }

  static spawnPackageManager (packageManager) {
    const args = process.argv.slice(2)
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
