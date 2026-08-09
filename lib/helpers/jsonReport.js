'use strict'

const pkg = require('../../package.json')
const { marshallCategories } = require('../marshalls/constants')
const { createAuditFailure } = require('./auditFailure')

function normalizeMarshallGroup(group = {}) {
  const findings = []

  for (const value of Object.values(group)) {
    if (!value || typeof value !== 'object') continue
    const category = marshallCategories[value.categoryId] || {
      id: value.categoryId,
      title: value.categoryId
    }

    for (const warning of value.warnings || []) {
      findings.push({
        severity: 'warning',
        marshall: value.marshall,
        category: { id: category.id, title: category.title },
        message: warning.message
      })
    }
    for (const error of value.errors || []) {
      findings.push({
        severity: 'error',
        marshall: value.marshall,
        category: { id: category.id, title: category.title },
        message: error.message
      })
    }
  }

  return findings
}

function buildJsonReport({
  packages = [],
  marshallResults = {},
  failures = [],
  version = pkg.version
} = {}) {
  const packageReports = packages.map((requested) => ({
    requested,
    findings: (marshallResults[requested] || []).flatMap(normalizeMarshallGroup)
  }))
  const findings = packageReports.flatMap((entry) => entry.findings)
  const errors = findings.filter((item) => item.severity === 'error').length
  const warnings = findings.filter((item) => item.severity === 'warning').length
  const status =
    failures.length > 0 ? 'failed' : errors + warnings > 0 ? 'findings' : 'clean'

  return {
    schemaVersion: 1,
    tool: { name: 'npq', version },
    status,
    summary: { packagesAudited: packageReports.length, errors, warnings },
    packages: packageReports,
    failures: failures.map((failure) =>
      createAuditFailure(failure.code, failure.message, {
        package: failure.package,
        marshall: failure.marshall
      })
    )
  }
}

function exitCodeForJsonReport(report) {
  return report.status === 'failed' ? 2 : report.status === 'findings' ? 1 : 0
}

module.exports = { buildJsonReport, exitCodeForJsonReport }
