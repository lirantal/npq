jest.mock('pacote')
jest.mock('node-fetch')

const fetch = require('node-fetch')

const ProvenanceMarshall = require('../lib/marshalls/provenance.marshall')
const pacote = require('pacote')

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
    // Mock the response from fetch
    const mockResponse = {
      json: jest.fn().mockResolvedValue({
        keys: [
          {
            key: 'publicKey1'
          },
          {
            key: 'publicKey2'
          }
        ]
      })
    }
    fetch.mockImplementationOnce(() => Promise.resolve(mockResponse))

    pacote.manifest = jest.fn().mockResolvedValue({
      name: 'packageName',
      version: '1.0.0',
      _attestations: {
        url: 'https://registry.npmjs.org/-/npm/v1/attestations/pacote@17.0.4',
        provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
      }
    })

    // Call the validate method with a package object
    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve({
              name: pkg.packageName,
              version: pkg.packageVersion
            })
          })
        },
        parsePackageVersion: (pkgVersion) => {
          return {
            version: pkgVersion
          }
        }
      }
    })

    // We assert that the validate method didn't throw an error,
    // because the keys match the signature
    await testMarshall.validate(pkg)

    // Assert that the fetch method is called with the correct URL
    // eslint-disable-next-line no-undef
    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')

    // Assert that the pacote.manifest method is called with the correct arguments
    expect(pacote.manifest).toHaveBeenCalledWith('packageName@1.0.0', {
      verifyAttestations: true,
      registry: 'https://registry.npmjs.org',
      '//registry.npmjs.org/:_keys': [
        {
          key: 'publicKey1',
          pemkey: '-----BEGIN PUBLIC KEY-----\npublicKey1\n-----END PUBLIC KEY-----'
        },
        {
          key: 'publicKey2',
          pemkey: '-----BEGIN PUBLIC KEY-----\npublicKey2\n-----END PUBLIC KEY-----'
        }
      ]
    })
  })

  test('should throw an error if attestation verification fails and manifest() throws an error', async () => {
    // Mock the response from fetch
    const mockResponse = {
      json: jest.fn().mockResolvedValue({
        keys: [
          {
            key: 'publicKey1'
          },
          {
            key: 'publicKey2'
          }
        ]
      })
    }
    fetch.mockImplementationOnce(() => Promise.resolve(mockResponse))

    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    // the manifest() method should throw an error
    // in this jest mock to simulate a problem:
    pacote.manifest = jest.fn().mockRejectedValue(new Error('mocked manifest error'))

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve({
              name: pkg.packageName,
              version: pkg.packageVersion
            })
          })
        },
        parsePackageVersion: (pkgVersion) => {
          return {
            version: pkgVersion
          }
        }
      }
    })

    // We assert that the validate method didn't throw an error,
    // because the keys match the signature
    await expect(testMarshall.validate(pkg)).rejects.toThrow('mocked manifest error')

    // Assert that the fetch method is called with the correct URL
    // eslint-disable-next-line no-undef
    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')
  })

  test('should throw a warning if attestations cant be found for the package', async () => {
    // Mock the response from fetch
    const mockResponse = {
      json: jest.fn().mockResolvedValue({
        keys: [
          {
            key: 'publicKey1'
          },
          {
            key: 'publicKey2'
          }
        ]
      })
    }
    fetch.mockImplementationOnce(() => Promise.resolve(mockResponse))

    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    pacote.manifest = jest.fn().mockResolvedValue({
      name: 'packageName',
      version: '1.0.0'
    })

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve({
              name: pkg.packageName,
              version: pkg.packageVersion
            })
          })
        },
        parsePackageVersion: (pkgVersion) => {
          return {
            version: pkgVersion
          }
        }
      }
    })

    // We assert that the validate method didn't throw an error,
    // because the keys match the signature
    await expect(testMarshall.validate(pkg)).rejects.toThrow(
      'the package was published without any attestations. Proceed with care.'
    )

    // Assert that the fetch method is called with the correct URL
    // eslint-disable-next-line no-undef
    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')
  })
})
