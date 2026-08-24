'use strict'

const path = require('node:path')
const Marshall = require('../../lib/marshall')
const Marshalls = require('../../lib/marshalls')
const PackageRepoUtils = require('../../lib/helpers/packageRepoUtils')
const { AUDIT_FAILURE_CODES, createAuditFailure } = require('../../lib/helpers/auditFailure')

const scenario = process.env.NPQ_JSON_TEST_SCENARIO

if (scenario === 'debug') {
  Marshalls.collectMarshalls = async () => [path.join(__dirname, 'json-debug.marshall.js')]
  PackageRepoUtils.prototype.getPackageInfo = async () => ({})
} else if (scenario) {
  Marshall.prototype.process = async function processJsonFixture() {
    if (scenario === 'sigint') {
      setInterval(() => {}, 1000)
      if (process.send) process.send({ ready: true })
      return new Promise(() => {})
    }

    if (scenario === 'failure') {
      this.onAuditFailure(
        createAuditFailure(
          AUDIT_FAILURE_CODES.PACKAGE_LOOKUP_FAILED,
          'Unable to retrieve package metadata',
          { package: this.pkgs[0] }
        )
      )
      return this.preserveRequestOrder ? this.pkgs.map(() => []) : {}
    }

    if (scenario === 'findings') {
      const result = [
        {
          scripts: {
            marshall: 'scripts',
            categoryId: 'SupplyChainSecurity',
            warnings: [{ message: 'Install script detected' }],
            errors: []
          }
        }
      ]
      const packageResults = this.pkgs.length > 0 ? { [this.pkgs[0]]: result } : {}
      return this.preserveRequestOrder ? this.pkgs.map(() => result) : packageResults
    }

    if (scenario === 'errors') {
      const result = [
        {
          scripts: {
            marshall: 'scripts',
            categoryId: 'SupplyChainSecurity',
            warnings: [],
            errors: [{ message: 'Install script detected' }]
          }
        }
      ]
      const packageResults = this.pkgs.length > 0 ? { [this.pkgs[0]]: result } : {}
      return this.preserveRequestOrder ? this.pkgs.map(() => result) : packageResults
    }

    return this.preserveRequestOrder ? this.pkgs.map(() => []) : {}
  }
}
