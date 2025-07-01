'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'scripts'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.MalwareDetection.id
  }

  title() {
    return 'Checking package for pre/post install scripts'
  }

  validate(pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then((data) => {
      const packageVersion =
        pkg.packageVersion === 'latest'
          ? data['dist-tags'] && data['dist-tags'].latest
          : this.packageRepoUtils.parsePackageVersion(pkg.packageVersion).version

      if (!packageVersion) {
        return true
      }

      const packageScripts =
        data &&
        data.versions &&
        data.versions[packageVersion] &&
        data.versions[packageVersion].scripts

      // blacklisted scripts due to possible malicious intent:
      const blacklistScripts = ['install', 'preinstall', 'postinstall']

      blacklistScripts.forEach((scriptName) => {
        if (
          packageScripts &&
          packageScripts.hasOwnProperty(scriptName) &&
          packageScripts[scriptName].length > 0
        ) {
          throw new Error(
            `Detected a possible malicious intent script, audit required: ${scriptName}: ${packageScripts[scriptName]}`
          )
        }
      })

      return true
    })
  }
}

module.exports = Marshall
