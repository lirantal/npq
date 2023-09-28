'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'snyk'
const SNYK_API_URL = 'https://snyk.io/api/v1/vuln/npm'
const SNYK_TEST_URL = 'https://snyk.io/test/npm'
const SNYK_PACKAGE_PAGE = 'https://snyk.io/vuln/npm:'
const SNYK_API_TOKEN = process.env.SNYK_TOKEN
const SNYK_CONFIG_FILE = '.config/configstore/snyk.json'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME

    this.snykApiToken = this.getSnykToken()
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

        if (data && data.issuesCount && data.issuesCount > 0) {
          const packageSecurityInfo = `${SNYK_PACKAGE_PAGE}${encodeURIComponent(pkg.packageName)}`
          throw new Error(`${data.issuesCount} vulnerabilitie(s) found: ${packageSecurityInfo}`)
        }

        return data
      })
  }

  getSnykVulnInfoUnauthenticated({ packageName, packageVersion }) {
    const url = encodeURI(`${SNYK_TEST_URL}/${packageName}/${packageVersion}?type=json`)

    return fetch(url)
      .then((response) => response.json())
      .then((data) => {
        // format returned results the way that the
        // official test API endpoint returns them in
        if (data && data.hasOwnProperty('totalVulns')) {
          return {
            issuesCount: data.totalVulns
          }
        }
      })
      .catch(() => false)
  }

  getSnykVulnInfo({ packageName, packageVersion } = {}) {
    if (!this.snykApiToken) {
      return this.getSnykVulnInfoUnauthenticated({ packageName, packageVersion })
    }

    const url = `${SNYK_API_URL}/${encodeURIComponent(packageName + '@' + packageVersion)}`

    return fetch(url, {
      headers: {
        Authorization: `token ${this.snykApiToken}`
      }
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.vulnerabilities) {
          return {
            issuesCount: data.vulnerabilities.length
          }
        }

        return false
      })
      .catch(() => false)
  }

  getSnykToken() {
    if (SNYK_API_TOKEN) {
      return SNYK_API_TOKEN
    }

    const snykConfigPath = path.join(os.homedir(), SNYK_CONFIG_FILE)

    try {
      if (fs.statSync(snykConfigPath)) {
        const snykConfig = require(snykConfigPath)
        if (snykConfig && snykConfig.api) {
          return snykConfig.api
        }
      }
    } catch (error) {
      return null
    }

    return null
  }
}

module.exports = Marshall
