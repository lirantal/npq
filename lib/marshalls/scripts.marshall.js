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

  async validate(pkg) {
    const data = await this.packageRepoUtils.getPackageInfo(pkg.packageName)

    if (!data) {
      return true
    }

    const packageVersion = await this.resolvePackageVersion(
      pkg.packageName,
      pkg.packageVersion,
      data
    )

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
        packageScripts[scriptName] &&
        String(packageScripts[scriptName]).length > 0
      ) {
        const scriptContent = packageScripts[scriptName]
        throw new Error(
          `Detected a possible malicious intent script, audit required: ${scriptName}: ${scriptContent}`
        )
      }
    })

    return true
  }
}

module.exports = Marshall
