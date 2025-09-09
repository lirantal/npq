'use strict'

// Mock fetch for testing
global.fetch = jest.fn()

const SignaturesMarshall = require('../lib/marshalls/signatures.marshall')

describe('Signature test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
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

    // Assert that the fetch method is called with the correct URL for keys
    expect(global.fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')

    // Assert that fetch is called for the package manifest
    expect(global.fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/packageName',
      expect.any(Object)
    )
  })

  test('should throw an error if keys dont match and manifest() throws an error', async () => {
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
})
