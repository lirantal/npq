'use strict'

const { createJsonOutput } = require('./helpers/jsonOutput')
const { buildJsonReport, exitCodeForJsonReport } = require('./helpers/jsonReport')
const { AUDIT_FAILURE_CODES, createAuditFailure } = require('./helpers/auditFailure')
const { runJsonAudit } = require('./jsonAudit')

function writeInvalidJsonInvocation(output = createJsonOutput()) {
  const report = buildJsonReport({
    failures: [
      createAuditFailure(AUDIT_FAILURE_CODES.INVALID_INPUT, 'Invalid package or option argument')
    ]
  })
  output.write(report)
  return report
}

async function runJsonCli(cliArgs, dependencies = {}) {
  const output = dependencies.output || createJsonOutput()
  const processTarget = dependencies.processTarget || process
  const audit = dependencies.runJsonAudit || runJsonAudit
  const getExitCode = dependencies.exitCodeForJsonReport || exitCodeForJsonReport
  let interrupted = false
  let interruptedReport

  const interrupt = () => {
    interrupted = true
    interruptedReport = buildJsonReport({
      packages: cliArgs.packages || [],
      failures: [createAuditFailure(AUDIT_FAILURE_CODES.INTERRUPTED, 'Audit interrupted')]
    })
    output.write(interruptedReport, () => {
      processTarget.exit(2)
    })
  }

  processTarget.once('SIGINT', interrupt)
  let report
  try {
    report = await audit(cliArgs)
  } catch {
    report = buildJsonReport({
      packages: cliArgs.packages || [],
      failures: [
        createAuditFailure(AUDIT_FAILURE_CODES.INTERNAL_ERROR, 'JSON audit could not complete')
      ]
    })
  } finally {
    processTarget.removeListener('SIGINT', interrupt)
  }

  if (interrupted) {
    return interruptedReport
  }

  output.write(report)
  processTarget.exitCode = getExitCode(report)
  return report
}

module.exports = { runJsonCli, writeInvalidJsonInvocation }
