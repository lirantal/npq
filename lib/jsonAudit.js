'use strict'

const { getProjectPackages } = require('./helpers/sourcePackages')
const Marshall = require('./marshall')
const { promiseThrottleHelper } = require('./helpers/promiseThrottler')
const { buildJsonReport } = require('./helpers/jsonReport')
const { AUDIT_FAILURE_CODES, createAuditFailure } = require('./helpers/auditFailure')
const { isJsonRegistryPackageSpec } = require('./helpers/jsonPackageSpec')

async function runJsonAudit(cliArgs, dependencies = {}) {
  const getPackages = dependencies.getProjectPackages || getProjectPackages
  const MarshallClass = dependencies.Marshall || Marshall
  const throttle = dependencies.promiseThrottleHelper || promiseThrottleHelper
  let packages = cliArgs.packages || []
  const failures = []

  try {
    if (packages.length === 0) {
      const projectPackages = await getPackages()
      if (projectPackages && projectPackages.error) {
        return buildJsonReport({
          failures: [
            createAuditFailure(
              AUDIT_FAILURE_CODES.PROJECT_MANIFEST_ERROR,
              'Unable to read project package.json'
            )
          ]
        })
      }
      packages = projectPackages
    }

    if (!packages.every(isJsonRegistryPackageSpec)) {
      return buildJsonReport({
        failures: [
          createAuditFailure(
            AUDIT_FAILURE_CODES.INVALID_INPUT,
            'Invalid package or option argument'
          )
        ]
      })
    }

    const marshall = new MarshallClass({
      pkgs: packages,
      progressManager: null,
      promiseThrottleHelper: throttle,
      preserveRequestOrder: true,
      suppressOutput: true,
      onAuditFailure: (failure) => failures.push(failure)
    })
    const marshallResults = await marshall.process()
    return buildJsonReport({ packages, marshallResults, failures })
  } catch {
    failures.push(
      createAuditFailure(
        AUDIT_FAILURE_CODES.INTERNAL_ERROR,
        'JSON audit could not complete'
      )
    )
    return buildJsonReport({ packages, failures })
  }
}

module.exports = { runJsonAudit }
