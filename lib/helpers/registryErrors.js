'use strict'

function sanitizeRegistryUrl(value) {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return 'configured registry'
  }
}

class RegistryError extends Error {
  constructor(
    message,
    { registry = null, code = 'EREGISTRY', statusCode = null, cause = null } = {}
  ) {
    const sanitizedRegistry = registry ? sanitizeRegistryUrl(registry) : null
    super(sanitizedRegistry ? `${message} (${sanitizedRegistry})` : message, {
      cause: cause || undefined
    })
    this.name = 'RegistryError'
    this.code = code
    this.statusCode = statusCode
    this.registry = sanitizedRegistry
  }
}

module.exports = { RegistryError, sanitizeRegistryUrl }
