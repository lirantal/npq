'use strict'

const NotEvaluated = require('../lib/helpers/notEvaluated')
const RegistryConfig = require('../lib/helpers/registryConfig')
const RegistryClient = require('../lib/helpers/registryClient')
const { RegistryError } = require('../lib/helpers/registryErrors')

function createConfig(options = {}) {
  return new RegistryConfig({
    registry: 'https://registry.npmjs.org/',
    '@company:registry':
      'https://artifactory.example.test/artifactory/api/npm/company/',
    ...options
  })
}

function httpError(statusCode) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode })
}

describe('RegistryClient', () => {
  test('provides a public default client', () => {
    expect(RegistryClient.public().registryFor('left-pad')).toBe(
      'https://registry.npmjs.org/'
    )
  })

  test('routes scoped package metadata through npm-registry-fetch options', async () => {
    const fetcher = {
      json: jest.fn().mockResolvedValue({ name: '@company/tool', versions: {} })
    }
    const client = new RegistryClient(createConfig(), { fetcher })

    await client.getPackageInfo('@company/tool')

    expect(fetcher.json).toHaveBeenCalledWith(
      '@company%2ftool',
      expect.objectContaining({
        spec: '@company/tool',
        registry: 'https://registry.npmjs.org/',
        '@company:registry':
          'https://artifactory.example.test/artifactory/api/npm/company/'
      })
    )
  })

  test('returns existing not-found data for package metadata 404', async () => {
    const fetcher = { json: jest.fn().mockRejectedValue(httpError(404)) }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getPackageInfo('missing-package')).resolves.toEqual({
      error: 'Not found'
    })
  })

  test.each([
    [401, 'EREGISTRYAUTH'],
    [403, 'EREGISTRYAUTH'],
    [500, 'EREGISTRYHTTP']
  ])('maps HTTP %s metadata failures to %s', async (statusCode, code) => {
    const fetcher = {
      json: jest.fn().mockRejectedValue(httpError(statusCode))
    }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getPackageInfo('private-package')).rejects.toMatchObject(
      {
        name: 'RegistryError',
        code,
        statusCode
      }
    )
  })

  test('maps transport failures to fatal registry errors', async () => {
    const fetcher = {
      json: jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'))
    }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getPackageInfo('private-package')).rejects.toMatchObject(
      {
        name: 'RegistryError',
        code: 'EREGISTRYNETWORK'
      }
    )
  })

  test('rejects malformed package metadata as a protocol failure', async () => {
    const fetcher = { json: jest.fn().mockResolvedValue('not-an-object') }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getPackageInfo('private-package')).rejects.toMatchObject(
      {
        name: 'RegistryError',
        code: 'EREGISTRYPROTOCOL'
      }
    )
  })

  test('selects exact and latest manifests from a supplied packument', async () => {
    const client = new RegistryClient(createConfig(), {
      fetcher: { json: jest.fn() }
    })
    const packument = {
      'dist-tags': { latest: '2.0.0' },
      time: { '2.0.0': '2026-01-01T00:00:00.000Z' },
      versions: {
        '1.0.0': { name: 'pkg', version: '1.0.0' },
        '2.0.0': { name: 'pkg', version: '2.0.0' }
      }
    }

    await expect(client.getManifest('pkg@1.0.0', packument)).resolves.toMatchObject({
      version: '1.0.0'
    })
    await expect(client.getManifest('pkg@latest', packument)).resolves.toMatchObject({
      version: '2.0.0',
      _time: '2026-01-01T00:00:00.000Z'
    })
    await expect(client.getManifest('pkg@3.0.0', packument)).rejects.toThrow(
      'Version 3.0.0 not found for package pkg'
    )
  })

  test('fetches a packument when one is not supplied for a manifest', async () => {
    const fetcher = {
      json: jest.fn().mockResolvedValue({
        versions: {
          '1.0.0': { name: 'pkg', version: '1.0.0' }
        }
      })
    }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getManifest('pkg@1.0.0')).resolves.toMatchObject({
      version: '1.0.0'
    })
  })

  test.each([404, 405, 501])(
    'classifies signing-key HTTP %s as unavailable',
    async (statusCode) => {
      const fetcher = {
        json: jest.fn().mockRejectedValue(httpError(statusCode))
      }
      const client = new RegistryClient(createConfig(), { fetcher })

      await expect(client.getRegistryKeys('@company/tool')).rejects.toBeInstanceOf(
        NotEvaluated
      )
    }
  )

  test('caches unavailable signing-key capability per registry', async () => {
    const fetcher = { json: jest.fn().mockRejectedValue(httpError(404)) }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getRegistryKeys('@company/one')).rejects.toBeInstanceOf(
      NotEvaluated
    )
    await expect(client.getRegistryKeys('@company/two')).rejects.toBeInstanceOf(
      NotEvaluated
    )
    expect(fetcher.json).toHaveBeenCalledTimes(1)
  })

  test('formats and caches registry keys', async () => {
    const fetcher = {
      json: jest.fn().mockResolvedValue({
        keys: [{ keyid: 'key-1', key: 'PUBLICKEY' }]
      })
    }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getRegistryKeys('one')).resolves.toEqual([
      {
        keyid: 'key-1',
        key: 'PUBLICKEY',
        pemkey:
          '-----BEGIN PUBLIC KEY-----\nPUBLICKEY\n-----END PUBLIC KEY-----'
      }
    ])
    await client.getRegistryKeys('two')
    expect(fetcher.json).toHaveBeenCalledTimes(1)
  })

  test('treats empty keys as cached unavailable capability', async () => {
    const fetcher = { json: jest.fn().mockResolvedValue({ keys: [] }) }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getRegistryKeys('one')).rejects.toBeInstanceOf(
      NotEvaluated
    )
    await expect(client.getRegistryKeys('two')).rejects.toBeInstanceOf(
      NotEvaluated
    )
    expect(fetcher.json).toHaveBeenCalledTimes(1)
  })

  test('rejects malformed key responses', async () => {
    const fetcher = { json: jest.fn().mockResolvedValue({ invalid: true }) }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getRegistryKeys('one')).rejects.toMatchObject({
      name: 'RegistryError',
      code: 'EREGISTRYPROTOCOL'
    })
  })

  test('rebases advertised attestation paths onto the scoped registry', async () => {
    const fetcher = {
      json: jest.fn().mockResolvedValue({ attestations: [{ bundle: {} }] })
    }
    const client = new RegistryClient(createConfig(), { fetcher })
    const manifest = {
      dist: {
        attestations: {
          url: 'https://registry.npmjs.org/-/npm/v1/attestations/tool@1.0.0'
        }
      }
    }

    await expect(
      client.getAttestations('@company/tool', manifest)
    ).resolves.toEqual([{ bundle: {} }])
    expect(fetcher.json).toHaveBeenCalledWith(
      '-/npm/v1/attestations/tool@1.0.0',
      expect.objectContaining({ spec: '@company/tool' })
    )
  })

  test('rejects malformed attestation URLs and responses', async () => {
    const fetcher = { json: jest.fn().mockResolvedValue({ invalid: true }) }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(
      client.getAttestations('@company/tool', {
        dist: { attestations: { url: 'not a url' } }
      })
    ).rejects.toMatchObject({ code: 'EREGISTRYPROTOCOL' })
    await expect(
      client.getAttestations('@company/tool', {
        dist: {
          attestations: {
            url: 'https://registry.npmjs.org/-/npm/v1/attestations/tool@1.0.0'
          }
        }
      })
    ).rejects.toMatchObject({ code: 'EREGISTRYPROTOCOL' })
  })

  test('caches unavailable attestation capability per registry', async () => {
    const fetcher = { json: jest.fn().mockRejectedValue(httpError(404)) }
    const client = new RegistryClient(createConfig(), { fetcher })
    const manifest = {
      dist: {
        attestations: {
          url: 'https://registry.npmjs.org/-/npm/v1/attestations/tool@1.0.0'
        }
      }
    }

    await expect(
      client.getAttestations('@company/one', manifest)
    ).rejects.toBeInstanceOf(NotEvaluated)
    await expect(
      client.getAttestations('@company/two', manifest)
    ).rejects.toBeInstanceOf(NotEvaluated)
    expect(fetcher.json).toHaveBeenCalledTimes(1)
  })

  test('treats empty attestations as unavailable', async () => {
    const fetcher = {
      json: jest.fn().mockResolvedValue({ attestations: [] })
    }
    const client = new RegistryClient(createConfig(), { fetcher })
    const manifest = {
      dist: {
        attestations: {
          url: 'https://registry.npmjs.org/-/npm/v1/attestations/tool@1.0.0'
        }
      }
    }

    await expect(
      client.getAttestations('@company/tool', manifest)
    ).rejects.toBeInstanceOf(NotEvaluated)
  })

  test('does not query public downloads for custom-registry packages', async () => {
    const fetcher = { json: jest.fn() }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getDownloadInfo('@company/tool')).rejects.toMatchObject({
      name: 'NotEvaluated',
      capability: 'download-counts'
    })
    expect(fetcher.json).not.toHaveBeenCalled()
  })

  test('queries the public npm downloads service only for public packages', async () => {
    const fetcher = {
      json: jest.fn().mockResolvedValue({ downloads: 1234 })
    }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getDownloadInfo('left-pad')).resolves.toBe(1234)
    expect(fetcher.json).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/point/last-month/left-pad',
      expect.objectContaining({ spec: 'left-pad' })
    )
  })

  test('rejects malformed public download responses', async () => {
    const fetcher = { json: jest.fn().mockResolvedValue({ downloads: 'many' }) }
    const client = new RegistryClient(createConfig(), { fetcher })

    await expect(client.getDownloadInfo('left-pad')).rejects.toMatchObject({
      name: 'RegistryError',
      code: 'EREGISTRYPROTOCOL'
    })
  })

  test('keeps signing-key caches isolated across registries', async () => {
    const fetcher = {
      json: jest
        .fn()
        .mockResolvedValueOnce({ keys: [{ keyid: 'public', key: 'PUBLIC' }] })
        .mockResolvedValueOnce({ keys: [{ keyid: 'private', key: 'PRIVATE' }] })
    }
    const client = new RegistryClient(createConfig(), { fetcher })

    await client.getRegistryKeys('left-pad')
    await client.getRegistryKeys('@company/tool')

    expect(fetcher.json).toHaveBeenCalledTimes(2)
  })

  test('never includes cause text or URL credentials in public errors', async () => {
    const secret = 'super-secret'
    const fetcher = {
      json: jest
        .fn()
        .mockRejectedValue(
          new Error(
            `request failed for https://user:${secret}@artifactory.example.test/`
          )
        )
    }
    const config = createConfig({
      registry: `https://user:${secret}@artifactory.example.test/npm/`
    })
    const client = new RegistryClient(config, { fetcher })

    const error = await client.getPackageInfo('private-package').catch((err) => err)

    expect(error).toBeInstanceOf(RegistryError)
    expect(error.message).not.toContain(secret)
    expect(error.registry).not.toContain(secret)
    expect(JSON.stringify(error)).not.toContain(secret)
  })
})
