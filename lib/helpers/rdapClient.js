'use strict'

const IANA_DNS_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json'
const DEFAULT_TIMEOUT_MS = 3000

const rdapStatuses = Object.freeze({
  Registered: 'registered',
  NotFound: 'not-found',
  Inconclusive: 'inconclusive'
})

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

class RdapClient {
  constructor({
    fetcher = globalThis.fetch,
    bootstrapUrl = IANA_DNS_BOOTSTRAP_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}) {
    this.fetcher = fetcher
    this.bootstrapUrl = bootstrapUrl
    this.timeoutMs = timeoutMs
    this.bootstrapPromise = null
    this.domainPromises = new Map()
  }

  lookup(domain) {
    const normalizedDomain = domain.toLowerCase()
    if (!this.domainPromises.has(normalizedDomain)) {
      this.domainPromises.set(
        normalizedDomain,
        this.lookupUncached(normalizedDomain).catch((error) => ({
          status: rdapStatuses.Inconclusive,
          reason: error && (error.code || error.name || error.message)
        }))
      )
    }

    return this.domainPromises.get(normalizedDomain)
  }

  async lookupUncached(domain) {
    const bootstrap = await this.getBootstrap()
    const endpoint = this.findEndpoint(bootstrap, domain)

    if (!endpoint) {
      return { status: rdapStatuses.Inconclusive, reason: 'bootstrap-unavailable' }
    }

    const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`
    const lookupUrl = new URL(`domain/${encodeURIComponent(domain)}`, baseUrl).toString()
    const response = await this.request(lookupUrl)

    if (response.status === 404) {
      return { status: rdapStatuses.NotFound }
    }

    if (!response.ok) {
      return { status: rdapStatuses.Inconclusive, reason: `http-${response.status}` }
    }

    const body = await response.json()
    if (!body || body.objectClassName !== 'domain') {
      return { status: rdapStatuses.Inconclusive, reason: 'invalid-response' }
    }

    return { status: rdapStatuses.Registered }
  }

  getBootstrap() {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.loadBootstrap()
    }

    return this.bootstrapPromise
  }

  async loadBootstrap() {
    if (!isHttpsUrl(this.bootstrapUrl)) {
      throw new Error('RDAP bootstrap URL must use HTTPS')
    }

    const response = await this.request(this.bootstrapUrl)
    if (!response.ok) {
      throw new Error(`RDAP bootstrap request failed with HTTP ${response.status}`)
    }

    const bootstrap = await response.json()
    if (!bootstrap || !Array.isArray(bootstrap.services)) {
      throw new Error('RDAP bootstrap response is invalid')
    }

    return bootstrap
  }

  findEndpoint(bootstrap, domain) {
    const tld = domain.split('.').pop().toLowerCase()

    for (const service of bootstrap.services) {
      if (!Array.isArray(service) || !Array.isArray(service[0]) || !Array.isArray(service[1])) {
        continue
      }

      const handlesTld = service[0].some(
        (candidate) => typeof candidate === 'string' && candidate.toLowerCase() === tld
      )
      if (!handlesTld) {
        continue
      }

      return service[1].find((candidate) => typeof candidate === 'string' && isHttpsUrl(candidate))
    }

    return undefined
  }

  request(url) {
    if (!isHttpsUrl(url)) {
      throw new Error('RDAP requests must use HTTPS')
    }

    return this.fetcher(url, {
      headers: {
        accept: 'application/rdap+json, application/json'
      },
      redirect: 'error',
      signal: AbortSignal.timeout(this.timeoutMs)
    })
  }
}

const defaultRdapClient = new RdapClient()

module.exports = {
  DEFAULT_TIMEOUT_MS,
  IANA_DNS_BOOTSTRAP_URL,
  RdapClient,
  defaultRdapClient,
  rdapStatuses
}
