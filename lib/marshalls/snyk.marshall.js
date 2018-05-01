'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const axios = require('axios')
const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'snyk'
const SNYK_API_URL = 'https://snyk.io/api/v1/test/npm'
const SNYK_API_TOKEN = process.env.SNYK_TOKEN
const SNYK_CONFIG_FILE = '.config/configstore/snyk.json'

class Marshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME

    this.snykApiToken = this.getSnykToken()
  }

  title () {
    return 'Checking for known vulnerabilities'
  }

  run (ctx, task) {
    if (!this.snykApiToken) {
      return Promise.resolve().then(() => {
        this.setMessage({
          pkg: '*',
          message: `Unable to query for known vulnerabilities. Install snyk and authenticate or provide a SNYK_TOKEN env variable (https://snyk.io)`
        })
      })
    }

    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.checkPackage(currPkg, ctx, task))
    }, [])

    return Promise.all(tasks)
  }

  validate (pkg) {
    return this.getSnykVulnInfo({
      packageName: pkg.packageName,
      packageVersion: pkg.packageVersion
    }).then(data => {
      if (!data) {
        throw new Error('Unable to query vulnerabilities for packages')
      }

      if (data && data.hasOwnProperty('ok') && data.ok === false) {
        const issuesCount = data.issues && data.issues.vulnerabilities.length
        throw new Error(`${issuesCount} vulnerabilitie(s) found`)
      }

      return data
    })
  }

  getSnykVulnInfo ({ packageName, packageVersion } = {}) {
    const url = `${SNYK_API_URL}/${encodeURIComponent(
      packageName
    )}/${encodeURIComponent(packageVersion)}`
    return axios
      .get(url, {
        headers: {
          Authorization: `token ${this.snykApiToken}`
        }
      })
      .then(response => {
        return response.data
      })
      .catch(() => {
        return false
      })
  }

  getSnykToken () {
    if (SNYK_API_TOKEN) {
      return SNYK_API_TOKEN
    }

    const snykConfigPath = path.join(os.homedir(), SNYK_CONFIG_FILE)

    try {
      if (fs.statSync(snykConfigPath)) {
        let snykConfig = require(snykConfigPath)
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
