'use strict'

const { domainToASCII } = require('node:url')
const { parse } = require('tldts')

function normalizeMaintainerDomain(maintainerEmail) {
  const atIndex = typeof maintainerEmail === 'string' ? maintainerEmail.lastIndexOf('@') : -1
  const emailDomain = atIndex > 0 ? maintainerEmail.slice(atIndex + 1).trim() : ''

  if (!emailDomain || emailDomain.includes('@') || /\s/.test(emailDomain)) {
    return null
  }

  const hostname = emailDomain.replace(/\.+$/, '').toLowerCase()
  const asciiHostname = domainToASCII(hostname)
  if (!asciiHostname) {
    return null
  }

  const parsed = parse(asciiHostname, {
    allowPrivateDomains: false,
    detectSpecialUse: true
  })

  if (
    !parsed.domain ||
    parsed.isIcann !== true ||
    parsed.isIp ||
    parsed.isSpecialUse ||
    parsed.isPrivate
  ) {
    return null
  }

  return parsed.domain.toLowerCase()
}

module.exports = normalizeMaintainerDomain
