jest.mock('pacote', () => {
  return {
    // manifest method should be a promise that resolves to a value:
    manifest: jest.fn().mockResolvedValue({
      name: 'packageName',
      version: '1.0.0'
      // Add other relevant properties
    })
  }
})

jest.mock('node-fetch')

const fetch = require('node-fetch')

const SignaturesMarshall = require('../lib/marshalls/signatures.marshall')
const pacote = require('pacote')

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

    const testMarshall = new SignaturesMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve(pkgInfo)
          })
        }
      }
    })

    // Call the validate method with a package object
    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    // We assert that the validate method didn't throw an error,
    // because the keys match the signature
    await testMarshall.validate(pkg)

    // Assert that the fetch method is called with the correct URL
    // eslint-disable-next-line no-undef
    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')

    // Assert that the pacote.manifest method is called with the correct arguments
    expect(pacote.manifest).toHaveBeenCalledWith('packageName@1.0.0', {
      verifySignatures: true,
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

  test('should throw an error if keys dont match and manifest() throws an error', async () => {
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

    // the manifest() method should throw an error
    // in this jest mock to simulate a problem:
    pacote.manifest = jest.fn().mockRejectedValue(new Error('mocked manifest error'))

    const testMarshall = new SignaturesMarshall({
      packageRepoUtils: {
        getPackageInfo: (pkgInfo) => {
          return new Promise((resolve) => {
            resolve(pkgInfo)
          })
        }
      }
    })

    // Call the validate method with a package object
    const pkg = {
      packageName: 'packageName',
      packageVersion: '1.0.0'
    }

    // We assert that the validate method didn't throw an error,
    // because the keys match the signature
    await expect(testMarshall.validate(pkg)).rejects.toThrow('mocked manifest error')

    // Assert that the fetch method is called with the correct URL
    // eslint-disable-next-line no-undef
    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/-/npm/v1/keys')
  })
})
