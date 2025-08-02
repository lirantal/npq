/* eslint-disable indent */
'use strict'

const childProcess = require('child_process')
const DEFAULT_PKGMGR = 'npm'

class packageManager {
  static process(packageManagerOption) {
    const detectedPackageManager = packageManager.validatePackageManager(packageManagerOption)
    return packageManager.spawnPackageManager(detectedPackageManager)
  }

  static spawnPackageManager(packageManagerOption) {
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

    let cmd = `${packageManagerOption}`
    if (args.length > 0) {
      cmd += ` ${args.join(' ')}`
    }

    const child = childProcess.spawn(cmd, {
      stdio: 'inherit',
      shell: true
    })

    return Promise.resolve(child)
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
