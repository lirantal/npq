'use strict'

const BaseMarshall = require('./baseMarshall')
const validator = require('validator')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'author'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.SupplyChainSecurity.id
  }

  title() {
    return 'Identifying package author...'
  }

  /**
   * What do we check?
   * 1. Who is the user who published the package? in the pakument's `_npmUser` field
   * 2. Is this the first time we see this user publishing a package?
   *   If so, halt and report.
   * 3. Start from first version to latest version and check if they published
   *   the package before.
   *   If they did, and the difference between this published version date and
   *   first is more than 30 days then halt and report.
   * @param {*} pkg
   * @returns
   */
  async validate(pkg) {
    // @TODO move some of these utility functions about first package version
    // published, date diff, etc into the package repo utils
    const pakument = await this.packageRepoUtils.getPackageInfo(pkg.packageName)

    const packageVersion = await this.packageRepoUtils.getSemVer(
      pkg.packageName,
      pkg.packageVersion
    )

    // @TODO fix to work for both explicit versions (1.0.0) and also
    // for dis-tags (latest)
    const npmUser = pakument.versions[packageVersion]._npmUser
    if (!npmUser || !npmUser.email) {
      throw new Error('could not determine publishing user for this package version')
    }

    if (!validator.isEmail(npmUser.email)) {
      throw new Error('the publishing user has no valid email address')
    }

    let firstVersionForUser = null
    const versionPublishedDateString = pakument.time[packageVersion]
    for (const [version, versionMetadata] of Object.entries(pakument.versions)) {
      if (versionMetadata._npmUser && versionMetadata._npmUser.email === npmUser.email) {
        firstVersionForUser = versionMetadata
        break
      }
    }

    if (!firstVersionForUser || firstVersionForUser.version === packageVersion) {
      throw new Error(
        `This is first version the user ${npmUser.name} <${npmUser.email}> published this package`
      )
    }

    const firstPublishedDateString = pakument.time[firstVersionForUser.version]

    // get date in ms
    const currentDate = new Date()
    const dateDiffInMsVersionPublished = currentDate - new Date(versionPublishedDateString)
    let dateDiffVersionPublished = 0
    if (dateDiffInMsVersionPublished > 0) {
      dateDiffVersionPublished = Math.round(dateDiffInMsVersionPublished / (1000 * 60 * 60 * 24))
    }

    if (dateDiffVersionPublished <= 45) {
      const dateDiffInMs = new Date(versionPublishedDateString) - new Date(firstPublishedDateString)
      let dateDiffInDays = 0
      if (dateDiffInMs > 0) {
        dateDiffInDays = Math.round(dateDiffInMs / (1000 * 60 * 60 * 24))
      }

      if (dateDiffInDays <= 30) {
        throw new Error(
          `The user ${npmUser.name} <${npmUser.email}> published this package for the first time only ${dateDiffInDays} days prior to this version.`
        )
      }
    }

    return versionPublishedDateString
  }
}

module.exports = Marshall
