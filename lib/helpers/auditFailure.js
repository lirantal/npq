'use strict'

const AUDIT_FAILURE_CODES = Object.freeze({
  INVALID_INPUT: 'INVALID_INPUT',
  PROJECT_MANIFEST_ERROR: 'PROJECT_MANIFEST_ERROR',
  PACKAGE_LOOKUP_FAILED: 'PACKAGE_LOOKUP_FAILED',
  AUDIT_CHECK_FAILED: 'AUDIT_CHECK_FAILED',
  INTERRUPTED: 'INTERRUPTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
})

const knownCodes = new Set(Object.values(AUDIT_FAILURE_CODES))

function createAuditFailure(code, message, context = {}) {
  const failure = {
    code: knownCodes.has(code) ? code : AUDIT_FAILURE_CODES.INTERNAL_ERROR,
    message: String(message)
  }

  if (context.package) failure.package = String(context.package)
  if (context.marshall) failure.marshall = String(context.marshall)
  return failure
}

module.exports = { AUDIT_FAILURE_CODES, createAuditFailure }
