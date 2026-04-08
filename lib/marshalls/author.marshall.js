'use strict'

/**
 * Author Marshall - Package Publisher Security Checks
 *
 * This marshall performs three security checks related to package publishing:
 *
 * 1. NEW AUTHOR CHECK
 *    Detects if this is the first version ever published by this user for this package.
 *    - Condition: No prior versions exist from this user, OR the current version is their first.
 *    - Only flags if the version was published recently (≤21 days ago).
 *    - Rationale: A brand new publisher on an established package could indicate account
 *      compromise or malicious takeover. However, if the "first" version is old (e.g., 10 years),
 *      it's not a current risk.
 *
 * 2. DORMANT MAINTAINER CHECK
 *    Detects if the same maintainer (_npmUser email) had a prior publish on this package,
 *    then a long gap before the current version.
 *    - Gap > ~9 months: Error
 *    - Gap > ~6 months (and ≤9 months): Warning
 *    - Strict boundaries: exactly 183 or 274 days does not cross the next tier.
 *    - Rationale: Long-inactive accounts publishing again can indicate compromise or neglected keys.
 *
 * 3. VERSION RECENCY CHECK
 *    Detects if the current version being installed was published very recently.
 *    - ≤7 days: Throws an Error (high risk)
 *    - ≤30 days: Throws a Warning (moderate risk)
 *    - Only applies if version is ≤45 days old.
 *    - Rationale: Very recently published versions haven't had time for community review
 *      and could contain undiscovered malicious code. This is independent of author history.
 *
 * Checks run in order (1 → 2 → 3); the first thrown Error or Warning ends validation.
 */

const BaseMarshall = require('./baseMarshall')
const Warning = require('../helpers/warning')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'author'
const DORMANT_MAINTAINER_WARNING_DAYS = Math.round(365.25 / 2) // ~6 months (183)
const DORMANT_MAINTAINER_ERROR_DAYS = Math.round(365.25 * 0.75) // ~9 months (274)

/**
 * Latest publish time (ms) for `email` on this package strictly before `packageVersion`'s time.
 * @returns {number|null}
 */
function findLastPriorPublishTimeMsForEmail(pakument, packageVersion, email) {
  const currentTimeStr = pakument.time && pakument.time[packageVersion]
  if (!currentTimeStr || typeof currentTimeStr !== 'string') {
    return null
  }
  const currentMs = Date.parse(currentTimeStr)
  if (Number.isNaN(currentMs)) {
    return null
  }

  let bestMs = null
  for (const v of Object.keys(pakument.versions || {})) {
    const t = pakument.time && pakument.time[v]
    if (!t || typeof t !== 'string') {
      continue
    }
    const ver = pakument.versions[v]
    if (!ver || !ver._npmUser || ver._npmUser.email !== email) {
      continue
    }
    const priorMs = Date.parse(t)
    if (Number.isNaN(priorMs) || priorMs >= currentMs) {
      continue
    }
    if (bestMs === null || priorMs > bestMs) {
      bestMs = priorMs
    }
  }

  return bestMs
}

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
   * Validates package author and version recency for security risks.
   *
   * Performs three checks:
   * 1. New Author Check: Flags if this is the user's first publish of this package
   *    AND the version was published within the last 21 days.
   * 2. Dormant Maintainer Check: Prior publish by same email with a long gap before this release.
   * 3. Version Recency Check: Flags recently published versions regardless of author:
   *    - Error if ≤7 days old
   *    - Warning if ≤30 days old
   *
   * @param {Object} pkg - Package info with packageName and packageVersion
   * @returns {string} The version's publish date string if all checks pass
   * @throws {Error} If security risk is detected
   * @throws {Warning} If moderate risk is detected
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
    // for dist-tags (latest)
    const npmUser = pakument.versions[packageVersion]._npmUser
    if (!npmUser || !npmUser.email) {
      throw new Error('Could not determine publishing user for this package version')
    }

    // Agree with Colin on keeping email regex simple: https://colinhacks.com/essays/reasonable-email-regex
    const emailRegex =
      /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-.]*)[a-z0-9_'+-]@([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/i
    if (!emailRegex.test(npmUser.email)) {
      throw new Error('The publishing user has no valid email address')
    }

    let firstVersionForUser = null
    const versionPublishedDateString = pakument.time[packageVersion]
    for (const versionMetadata of Object.values(pakument.versions)) {
      if (versionMetadata._npmUser && versionMetadata._npmUser.email === npmUser.email) {
        firstVersionForUser = versionMetadata
        break
      }
    }

    if (!firstVersionForUser || firstVersionForUser.version === packageVersion) {
      // Only throw the error if also the `packageVersion` was published less than 21 days ago:
      if (versionPublishedDateString) {
        const dateDiffInMs = new Date() - new Date(versionPublishedDateString)
        let dateDiffInDays = 0

        if (dateDiffInMs > 0) {
          dateDiffInDays = Math.round(dateDiffInMs / (1000 * 60 * 60 * 24))
        }

        if (dateDiffInDays <= 21) {
          throw new Error(
            `The user ${npmUser.name} <${npmUser.email}> published this package for the first time only ${dateDiffInDays} days ago`
          )
        }
      }

      // otherwise, there's no point in throwing an error
      // because this version already exists for a while. for e.g: package `ncp` latest version
      // is from 10 years ago which was the first version published by the user, but that's
      // hardly a risk at this point being 10 years old, so we don't throw the following error:
      // throw new Error(
      //   `This is the first version the user ${npmUser.name} <${npmUser.email}> published this package`
      // )
    }

    const priorPublishMs = findLastPriorPublishTimeMsForEmail(
      pakument,
      packageVersion,
      npmUser.email
    )
    if (priorPublishMs !== null && versionPublishedDateString) {
      const currentMs = Date.parse(versionPublishedDateString)
      if (!Number.isNaN(currentMs)) {
        const gapMs = currentMs - priorPublishMs
        let gapDays = 0
        if (gapMs > 0) {
          gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24))
        }
        if (gapDays > DORMANT_MAINTAINER_ERROR_DAYS) {
          throw new Error(
            `The maintainer ${npmUser.name} <${npmUser.email}> had not published this package for ${gapDays} days before this release (more than 9 months dormant)`
          )
        }
        if (gapDays > DORMANT_MAINTAINER_WARNING_DAYS) {
          throw new Warning(
            `The maintainer ${npmUser.name} <${npmUser.email}> had not published this package for ${gapDays} days before this release (more than 6 months dormant)`
          )
        }
      }
    }

    // get date in ms
    const dateDiffInMsVersionPublished = new Date() - new Date(versionPublishedDateString)
    let dateDiffVersionPublished = 0
    if (dateDiffInMsVersionPublished > 0) {
      dateDiffVersionPublished = Math.round(dateDiffInMsVersionPublished / (1000 * 60 * 60 * 24))
    }

    if (dateDiffVersionPublished <= 45) {
      if (dateDiffVersionPublished <= 7) {
        throw new Error(
          `This version was published only ${dateDiffVersionPublished} days ago by ${npmUser.name} <${npmUser.email}>`
        )
      }

      if (dateDiffVersionPublished <= 30) {
        throw new Warning(
          `This version was published only ${dateDiffVersionPublished} days ago by ${npmUser.name} <${npmUser.email}>`
        )
      }
    }

    return versionPublishedDateString
  }
}

module.exports = Marshall
