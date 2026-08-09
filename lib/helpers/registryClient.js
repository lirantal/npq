'use strict'

const npa = require('npm-package-arg')
const npmFetch = require('npm-registry-fetch')
const NotEvaluated = require('./notEvaluated')
const RegistryConfig = require('./registryConfig')
const { RegistryError } = require('./registryErrors')

const PUBLIC_REGISTRY = 'https://registry.npmjs.org/'
const OPTIONAL_STATUS = new Set([404, 405, 501])
const CAPABILITY = Object.freeze({
  SIGNING_KEYS: 'signing-keys',
  ATTESTATIONS: 'attestations',
  DOWNLOAD_COUNTS: 'download-counts'
})
const CAPABILITY_MESSAGE = Object.freeze({
  [CAPABILITY.SIGNING_KEYS]: 'configured registry does not expose signing keys',
  [CAPABILITY.ATTESTATIONS]: 'configured registry does not expose attestations',
  [CAPABILITY.DOWNLOAD_COUNTS]: 'download counts are available only for the public npm registry'
})

class RegistryClient {
  constructor(registryConfig, { fetcher = npmFetch } = {}) {
    this.registryConfig = registryConfig
    this.fetcher = fetcher
    this.keyCache = new Map()
    this.capabilityCache = new Map()
  }

  static public() {
    return new RegistryClient(RegistryConfig.defaults())
  }

  registryFor(packageSpec) {
    return this.registryConfig.registryFor(packageSpec)
  }

  requestOptions(packageSpec) {
    return {
      ...this.registryConfig.requestOptions,
      spec: packageSpec,
      headers: {
        accept: 'application/json',
        'user-agent': 'npq-npm-registry-client'
      }
    }
  }

  async requestJson(requestPath, packageSpec, { capability = null, notFoundAsData = false } = {}) {
    const registry = this.registryFor(packageSpec)
    try {
      return await this.fetcher.json(requestPath, this.requestOptions(packageSpec))
    } catch (error) {
      const statusCode = error.statusCode || error.status || null
      if (notFoundAsData && statusCode === 404) {
        return { error: 'Not found' }
      }
      if (capability && OPTIONAL_STATUS.has(statusCode)) {
        this.capabilityCache.set(`${registry}|${capability}`, false)
        throw new NotEvaluated(CAPABILITY_MESSAGE[capability], { capability })
      }
      const code =
        statusCode === 401 || statusCode === 403
          ? 'EREGISTRYAUTH'
          : statusCode
            ? 'EREGISTRYHTTP'
            : 'EREGISTRYNETWORK'
      throw new RegistryError(
        statusCode === 401 || statusCode === 403
          ? 'Registry authentication or authorization failed'
          : statusCode
            ? `Registry request failed with HTTP ${statusCode}`
            : 'Registry network request failed',
        { registry, code, statusCode, cause: error }
      )
    }
  }

  async getPackageInfo(packageName) {
    const spec = npa(packageName)
    const data = await this.requestJson(spec.escapedName, packageName, {
      notFoundAsData: true
    })
    if (data && data.error === 'Not found') {
      return data
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new RegistryError('Registry package metadata is malformed', {
        registry: this.registryFor(packageName),
        code: 'EREGISTRYPROTOCOL'
      })
    }
    return data
  }

  async getManifest(packageSpec, packument = null) {
    const spec = npa(packageSpec)
    const data = packument || (await this.getPackageInfo(spec.name))
    let version = spec.fetchSpec
    if (!version || version === '*' || version === 'latest') {
      version = data['dist-tags'] && data['dist-tags'].latest
    }
    if (!data.versions || !data.versions[version]) {
      throw new Error(`Version ${version} not found for package ${spec.name}`)
    }
    return {
      ...data.versions[version],
      ...(data.time && data.time[version] ? { _time: data.time[version] } : {})
    }
  }

  unavailable(capability) {
    throw new NotEvaluated(CAPABILITY_MESSAGE[capability], { capability })
  }

  async getRegistryKeys(packageSpec) {
    const registry = this.registryFor(packageSpec)
    const cacheKey = `${registry}|${CAPABILITY.SIGNING_KEYS}`
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)
    }
    if (this.capabilityCache.get(cacheKey) === false) {
      return this.unavailable(CAPABILITY.SIGNING_KEYS)
    }
    const response = await this.requestJson('-/npm/v1/keys', packageSpec, {
      capability: CAPABILITY.SIGNING_KEYS
    })
    if (!response || !Array.isArray(response.keys)) {
      throw new RegistryError('Registry signing-key response is malformed', {
        registry,
        code: 'EREGISTRYPROTOCOL'
      })
    }
    if (response.keys.length === 0) {
      this.capabilityCache.set(cacheKey, false)
      return this.unavailable(CAPABILITY.SIGNING_KEYS)
    }
    const keys = response.keys.map((key) => ({
      ...key,
      pemkey: `-----BEGIN PUBLIC KEY-----\n${key.key}\n-----END PUBLIC KEY-----`
    }))
    this.keyCache.set(cacheKey, keys)
    return keys
  }

  async getAttestations(packageSpec, manifest) {
    const registry = this.registryFor(packageSpec)
    const cacheKey = `${registry}|${CAPABILITY.ATTESTATIONS}`
    if (this.capabilityCache.get(cacheKey) === false) {
      return this.unavailable(CAPABILITY.ATTESTATIONS)
    }
    let requestPath
    try {
      const advertisedPath = new URL(manifest.dist.attestations.url).pathname
      const registryPath = new URL(registry).pathname
      requestPath = advertisedPath.startsWith(registryPath)
        ? advertisedPath.slice(registryPath.length)
        : advertisedPath.replace(/^\/+/, '')
    } catch (error) {
      throw new RegistryError('Package attestation URL is malformed', {
        registry,
        code: 'EREGISTRYPROTOCOL',
        cause: error
      })
    }
    const response = await this.requestJson(requestPath, packageSpec, {
      capability: CAPABILITY.ATTESTATIONS
    })
    if (!response || !Array.isArray(response.attestations)) {
      throw new RegistryError('Registry attestation response is malformed', {
        registry,
        code: 'EREGISTRYPROTOCOL'
      })
    }
    if (response.attestations.length === 0) {
      this.capabilityCache.set(cacheKey, false)
      return this.unavailable(CAPABILITY.ATTESTATIONS)
    }
    return response.attestations
  }

  async getDownloadInfo(packageName) {
    if (this.registryFor(packageName) !== PUBLIC_REGISTRY) {
      return this.unavailable(CAPABILITY.DOWNLOAD_COUNTS)
    }
    const escapedName = npa(packageName).escapedName
    const response = await this.requestJson(
      `https://api.npmjs.org/downloads/point/last-month/${escapedName}`,
      packageName
    )
    if (!response || typeof response.downloads !== 'number') {
      throw new RegistryError('Registry download response is malformed', {
        registry: PUBLIC_REGISTRY,
        code: 'EREGISTRYPROTOCOL'
      })
    }
    return response.downloads
  }
}

module.exports = RegistryClient
