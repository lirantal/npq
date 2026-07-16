'use strict'

const { isIP } = require('node:net')
const { domainToASCII } = require('node:url')

const SPECIAL_USE_SUFFIXES = new Set([
  'alt',
  'corp',
  'example',
  'home',
  'internal',
  'invalid',
  'local',
  'localhost',
  'mail',
  'onion',
  'test'
])
const RESERVED_HOSTS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'home.arpa',
  'in-addr.arpa',
  'ip6.arpa'
])

function hasReservedSuffix(hostname, suffixes) {
  return [...suffixes].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))
}

function normalizeMaintainerDomain(maintainerEmail) {
  const atIndex = typeof maintainerEmail === 'string' ? maintainerEmail.lastIndexOf('@') : -1
  const hasOneAtSign = atIndex > 0 && maintainerEmail.indexOf('@') === atIndex
  const emailDomain = atIndex > 0 ? maintainerEmail.slice(atIndex + 1).trim() : ''

  if (!hasOneAtSign || !emailDomain || /\s/.test(emailDomain)) {
    return null
  }

  const hostname = emailDomain.replace(/\.$/, '').toLowerCase()
  const bracketedIp = hostname.match(/^\[(.*)\]$/)
  if (isIP(bracketedIp ? bracketedIp[1] : hostname)) {
    return null
  }

  const asciiHostname = domainToASCII(hostname).toLowerCase()
  const labels = asciiHostname.split('.')
  const labelsAreValid = labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9-]+$/.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-')
  )

  if (
    !asciiHostname ||
    isIP(asciiHostname) ||
    asciiHostname.length > 253 ||
    labels.length < 2 ||
    !labelsAreValid ||
    hasReservedSuffix(asciiHostname, SPECIAL_USE_SUFFIXES) ||
    hasReservedSuffix(asciiHostname, RESERVED_HOSTS)
  ) {
    return null
  }

  return asciiHostname
}

function isSimpleMaintainerDomain(domain) {
  return domain.split('.').length === 2
}

module.exports = { isSimpleMaintainerDomain, normalizeMaintainerDomain }
