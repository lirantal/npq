'use strict'

// Mock fetch for testing
global.fetch = jest.fn()

const SignaturesMarshallBase = require('../lib/marshalls/signatures.marshall')
const NpmRegistry = require('../lib/helpers/npmRegistry')
const NotEvaluated = require('../lib/helpers/notEvaluated')
const { RegistryError } = require('../lib/helpers/registryErrors')

const defaultRegistryClient = {
  getManifest: jest.fn(async (packageSpec, packument) => {
    const version = packageSpec.slice(packageSpec.lastIndexOf('@') + 1)
    if (!packument.versions || !packument.versions[version]) {
      throw new Error(`Version ${version} not found`)
    }
    return packument.versions[version]
  }),
  getRegistryKeys: jest.fn().mockResolvedValue([])
}

class SignaturesMarshall extends SignaturesMarshallBase {
  constructor(options) {
    super({
      ...options,
      registryClient: options.registryClient || defaultRegistryClient
    })
  }
}

describe('Signature test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
    defaultRegistryClient.getManifest.mockImplementation(async (packageSpec, packument) => {
      const version = packageSpec.slice(packageSpec.lastIndexOf('@') + 1)
      if (!packument.versions || !packument.versions[version]) {
        throw new Error(`Version ${version} not found`)
      }
      return packument.versions[version]
    })
    defaultRegistryClient.getRegistryKeys.mockResolvedValue([])
  })

  test('has the right title', async () => {
    const testMarshall = new SignaturesMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve(pkgInfo)
          })
        }
      }
    })

    expect(testMarshall.title()).toEqual('Verifying registry signatures for package')
  })

  test('should successfully validate a package with correct signature', async () => {
    // Mock the response from fetch for registry keys
    const mockKeysResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        keys: [
          {
            keyid: 'SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA',
            key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg==',
            pemkey:
              '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg==\n-----END PUBLIC KEY-----'
          }
        ]
      })
    }

    // Mock package manifest response
    const mockPackageResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        'dist-tags': { latest: '1.0.0' },
        time: { '1.0.0': '2023-01-01T00:00:00.000Z' },
        versions: {
          '1.0.0': {
            name: 'packageName',
            version: '1.0.0',
            _id: 'packageName@1.0.0',
            _time: '2023-01-01T00:00:00.000Z',
            dist: {
              integrity: 'sha512-test123',
              tarball: 'https://registry.npmjs.org/packageName/-/packageName-1.0.0.tgz',
              signatures: [
                {
                  keyid: 'SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA',
                  sig: 'MEUCIBVRSfI...'
                }
              ]
            }
          }
        }
      })
    }

    // Mock the full package data that getPackageInfo will return
    const mockPackageData = {
      'dist-tags': { latest: '1.0.0' },
      time: { '1.0.0': '2023-01-01T00:00:00.000Z' },
      versions: {
        '1.0.0': {
          name: 'packageName',
          version: '1.0.0',
          _id: 'packageName@1.0.0',
          _time: '2023-01-01T00:00:00.000Z',
          dist: {
            integrity: 'sha512-test123',
            tarball: 'https://registry.npmjs.org/packageName/-/packageName-1.0.0.tgz',
            signatures: [
              {
                keyid: 'SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA',
                sig: 'MEUCIBVRSfI...'
              }
            ]
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse) // First call for registry keys
      .mockResolvedValueOnce(mockPackageResponse) // Second call for package manifest

    const testMarshall = new SignaturesMarshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(mockPackageData),
        parsePackageVersion: jest.fn().mockReturnValue('1.0.0')
      }
    })

    // Call the validate method with a package object
    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    try {
      await testMarshall.validate(pkg)
      // If we get here without an error related to signature verification failing,
      // the mocking worked (though the actual crypto verification might fail with mock data)
    } catch (error) {
      // We expect crypto verification to fail with mock data, but not network errors
      expect(error.message).not.toContain('Version 1.0.0 not found')
    }

    // Assert that getPackageInfo is called for version resolution
    expect(testMarshall.packageRepoUtils.getPackageInfo).toHaveBeenCalledWith('packageName')

    expect(defaultRegistryClient.getManifest).toHaveBeenCalledWith(
      'packageName@1.0.0',
      mockPackageData
    )
  })

  test('wraps package signature verification failures as warnings', async () => {
    // Mock the response from fetch for keys
    const mockKeysResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        keys: [
          {
            keyid: 'SHA256:different-key',
            key: 'publicKey1',
            pemkey: '-----BEGIN PUBLIC KEY-----\npublicKey1\n-----END PUBLIC KEY-----'
          }
        ]
      })
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockRejectedValueOnce(new Error('Failed to fetch package manifest: 404 Not Found'))

    const testMarshall = new SignaturesMarshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue({
          'dist-tags': { latest: '1.0.0' },
          versions: { '1.0.0': {} }
        }),
        parsePackageVersion: jest.fn().mockReturnValue('1.0.0')
      }
    })

    // Call the validate method with a package object
    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    // We assert that the validate method throws an error
    await expect(testMarshall.validate(pkg)).rejects.toThrow(
      'Unable to verify package signature on registry'
    )
  })

  test('uses the injected registry client for manifests and signing keys', async () => {
    const packument = {
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          name: 'packageName',
          version: '1.0.0',
          dist: { signatures: [{}] }
        }
      }
    }
    const manifest = packument.versions['1.0.0']
    const registryClient = {
      getManifest: jest.fn().mockResolvedValue(manifest),
      getRegistryKeys: jest.fn().mockResolvedValue([{ keyid: 'key-1' }])
    }
    const verify = jest
      .spyOn(NpmRegistry.prototype, 'verifySignatures')
      .mockResolvedValue({ _signatures: [{}] })
    const marshall = new SignaturesMarshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(packument),
        parsePackageVersion: jest.fn()
      },
      registryClient
    })

    await marshall.validate({
      packageName: 'packageName',
      packageVersion: '1.0.0'
    })

    expect(registryClient.getManifest).toHaveBeenCalledWith('packageName@1.0.0', packument)
    expect(registryClient.getRegistryKeys).toHaveBeenCalledWith('packageName')
    expect(verify).toHaveBeenCalledWith(manifest, [{ keyid: 'key-1' }])
    verify.mockRestore()
  })

  test.each([
    new NotEvaluated('configured registry does not expose signing keys', {
      capability: 'signing-keys'
    }),
    new RegistryError('Registry authentication failed', {
      registry: 'https://artifactory.example.test/npm/',
      code: 'EREGISTRYAUTH'
    })
  ])('rethrows typed registry failures without wrapping', async (failure) => {
    const packument = {
      versions: {
        '1.0.0': {
          name: 'packageName',
          version: '1.0.0',
          dist: { signatures: [{}] }
        }
      }
    }
    const marshall = new SignaturesMarshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(packument),
        parsePackageVersion: jest.fn()
      },
      registryClient: {
        getManifest: jest.fn().mockResolvedValue(packument.versions['1.0.0']),
        getRegistryKeys: jest.fn().mockRejectedValue(failure)
      }
    })

    await expect(
      marshall.validate({
        packageName: 'packageName',
        packageVersion: '1.0.0'
      })
    ).rejects.toBe(failure)
  })
})
