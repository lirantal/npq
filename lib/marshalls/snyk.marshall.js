'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')

const MARSHALL_NAME = 'snyk'
const SNYK_PACKAGE_PAGE = 'https://snyk.io/vuln/npm:'
const SNYK_CONFIG_FILE = '.config/configstore/snyk.json'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.SupplyChainSecurity.id

    this.snykApiToken = this.getSnykToken()
    this.snykApiUrl = this.getSnykApiUrl()
  }

  getSnykApiUrl() {
    return process.env.SNYK_API_URL || process.env.SNYK_API || 'https://snyk.io/api/v1/vuln/npm'
  }

  title() {
    return 'Checking for known vulnerabilities'
  }

  run(ctx, task) {
    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.checkPackage(currPkg, ctx, task))
    }, [])

    return Promise.all(tasks)
  }

  validate(pkg) {
    return Promise.resolve()
      .then(() => {
        if (!pkg.packageVersion || pkg.packageVersion === 'latest') {
          return this.packageRepoUtils.getLatestVersion(pkg.packageName)
        }
      })
      .then((versionResolved) => {
        return this.getSnykVulnInfo({
          packageName: pkg.packageName,
          packageVersion: versionResolved || pkg.packageVersion
        })
      })
      .then((data) => {
        if (!data) {
          throw new Error('Unable to query vulnerabilities for packages')
        }

        if (data.issuesCount && data.issuesCount > 0) {
          if (this.snykApiToken) {
            const packageSecurityInfo = `${SNYK_PACKAGE_PAGE}${encodeURIComponent(pkg.packageName)}`
            if (data.isMaliciousPackage) {
              throw new Error(`Malicious package found: ${packageSecurityInfo}`)
            }

            throw new Error(`${data.issuesCount} vulnerable path(s) found: ${packageSecurityInfo}`)
          } else {
            throw new Error(
              `${data.issuesCount} vulnerabilities found by OSV for ${pkg.packageName}`
            )
          }
        }

        return data
      })
  }

  getOsvVulnerabilityInfo({ packageName, packageVersion }) {
    const url = 'https://api.osv.dev/v1/query'
    const body = {
      version: packageVersion,
      package: {
        name: packageName,
        ecosystem: 'npm'
      }
    }

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.vulns) {
          const isMaliciousPackage = data.vulns.some(
            (vuln) =>
              vuln.database_specific &&
              vuln.database_specific['malicious-packages-origins'] &&
              vuln.database_specific['malicious-packages-origins'].length > 0
          )

          return {
            issuesCount: data.vulns.length,
            isMaliciousPackage
          }
        }
        return {
          issuesCount: 0,
          isMaliciousPackage: false
        }
      })
      .catch(() => ({
        issuesCount: 0,
        isMaliciousPackage: false
      }))
  }

  getSnykVulnInfo({ packageName, packageVersion } = {}) {
    if (!this.snykApiToken) {
      return this.getOsvVulnerabilityInfo({ packageName, packageVersion })
    }

    const url = `${this.snykApiUrl}/${encodeURIComponent(packageName + '@' + packageVersion)}`

    return fetch(url, {
      headers: {
        Authorization: `token ${this.snykApiToken}`
      }
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Snyk API request failed with status ${response.status}`)
        }
        return response
      })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.vulnerabilities) {
          const isMaliciousPackage = data.vulnerabilities.some(
            (vulnerability) => vulnerability.title === 'Malicious Package'
          )

          return {
            issuesCount: data.vulnerabilities.length,
            isMaliciousPackage
          }
        }

        return false
      })
  }

  getSnykToken() {
    // Check for SNYK_API_TOKEN first, then fall back to SNYK_TOKEN
    const snykApiToken = process.env.SNYK_API_TOKEN || process.env.SNYK_TOKEN

    if (snykApiToken) {
      return snykApiToken
    }

    const snykConfigPath = path.join(os.homedir(), SNYK_CONFIG_FILE)

    try {
      if (fs.statSync(snykConfigPath)) {
        const snykConfig = JSON.parse(fs.readFileSync(snykConfigPath, 'utf8'))
        if (snykConfig && snykConfig.api) {
          return snykConfig.api
        }
      }
    } catch {
      return null
    }

    return null
  }
}

module.exports = Marshall
