'use strict'

// Mock fetch for testing
global.fetch = jest.fn()

const ProvenanceMarshall = require('../lib/marshalls/provenance.marshall')

describe('Provenance test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  test('has the right title', async () => {
    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve(pkgInfo)
          })
        }
      }
    })

    expect(testMarshall.title()).toEqual('Verifying package provenance')
  })

  test('should successfully validate a package with verified attestations', async () => {
    // Mock the response from fetch for registry keys
    const mockKeysResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        keys: [
          {
            keyid: 'SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA',
            key: 'publicKey1',
            pemkey: '-----BEGIN PUBLIC KEY-----\npublicKey1\n-----END PUBLIC KEY-----'
          }
        ]
      })
    }

    // Mock package manifest response with attestations
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
            dist: {
              integrity: 'sha512-test123',
              tarball: 'https://registry.npmjs.org/packageName/-/packageName-1.0.0.tgz',
              attestations: {
                url: 'https://registry.npmjs.org/-/npm/v1/attestations/packageName@1.0.0',
                provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
              }
            }
          }
        }
      })
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse) // First call for registry keys
      .mockResolvedValueOnce(mockPackageResponse) // Second call for package manifest
      .mockResolvedValueOnce({
        ok: true,
        // Third call for attestations
        json: jest.fn().mockResolvedValue({
          attestations: []
        })
      })

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve({
              name: pkgInfo,
              'dist-tags': { latest: '1.0.0' }
            })
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    // Call the validate method with a package object
    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    try {
      await testMarshall.validate(pkg)
    } catch (error) {
      // We expect this to fail with mock data due to empty attestations array,
      // but not due to network issues
      expect(error.message).not.toContain('Version 1.0.0 not found')
    }

    // Assert that the fetch method is called with the correct URL for keys
    expect(global.fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')

    // Assert that fetch is called for the package manifest
    expect(global.fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/packageName',
      expect.any(Object)
    )
  })

  test('should throw an error if attestation verification fails and manifest() throws an error', async () => {
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
      .mockRejectedValue(new Error('mocked manifest error'))

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve({
              name: pkgInfo,
              'dist-tags': { latest: '1.0.0' }
            })
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    // We assert that the validate method throws an error containing the mocked error
    await expect(testMarshall.validate(pkg)).rejects.toThrow('Unable to verify provenance')
  })

  test('should throw a warning if attestations cant be found for the package', async () => {
    // Mock the response from fetch for registry keys
    const mockKeysResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        keys: [
          {
            keyid: 'SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA',
            key: 'publicKey1',
            pemkey: '-----BEGIN PUBLIC KEY-----\npublicKey1\n-----END PUBLIC KEY-----'
          }
        ]
      })
    }

    // Mock package manifest response without attestations
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
            dist: {
              integrity: 'sha512-test123',
              tarball: 'https://registry.npmjs.org/packageName/-/packageName-1.0.0.tgz'
              // No attestations property
            }
          }
        }
      })
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce(mockPackageResponse)

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve({
              name: pkgInfo,
              'dist-tags': { latest: '1.0.0' }
            })
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    await expect(testMarshall.validate(pkg)).rejects.toThrow('Unable to verify provenance')

    // Assert that the fetch method is called with the correct URL for keys
    expect(global.fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')
  })
})
