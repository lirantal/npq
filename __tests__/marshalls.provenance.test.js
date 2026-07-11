'use strict'

// Mock fetch for testing
global.fetch = jest.fn()

const NpmRegistry = require('../lib/helpers/npmRegistry')
const ProvenanceMarshallBase = require('../lib/marshalls/provenance.marshall')
const Warning = require('../lib/helpers/warning')
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
  getRegistryKeys: jest.fn().mockResolvedValue([]),
  getAttestations: jest.fn().mockResolvedValue([])
}

class ProvenanceMarshall extends ProvenanceMarshallBase {
  constructor(options) {
    super({
      ...options,
      registryClient: options.registryClient || defaultRegistryClient
    })
  }
}

describe('Provenance test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
    jest.restoreAllMocks()
    defaultRegistryClient.getManifest.mockImplementation(async (packageSpec, packument) => {
      const version = packageSpec.slice(packageSpec.lastIndexOf('@') + 1)
      if (!packument.versions || !packument.versions[version]) {
        throw new Error(`Version ${version} not found`)
      }
      return packument.versions[version]
    })
    defaultRegistryClient.getRegistryKeys.mockResolvedValue([])
    defaultRegistryClient.getAttestations.mockResolvedValue([])
  })

  test('returns _attestations when verifyAttestations resolves successfully', async () => {
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

    const packument = {
      name: 'okProv',
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          name: 'okProv',
          version: '1.0.0',
          dist: {
            integrity: 'sha512-x',
            tarball: 'https://registry.npmjs.org/okProv/-/okProv-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/okProv@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest.spyOn(NpmRegistry.prototype, 'verifyAttestations').mockResolvedValue({
      name: 'okProv',
      version: '1.0.0',
      dist: packument.versions['1.0.0'].dist,
      _attestations: packument.versions['1.0.0'].dist.attestations
    })

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const result = await testMarshall.validate({
      packageName: 'okProv',
      packageVersion: '1.0.0'
    })

    expect(result).toEqual(packument.versions['1.0.0'].dist.attestations)
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

    expect(defaultRegistryClient.getManifest).toHaveBeenCalled()
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

    const err = await testMarshall.validate(pkg).catch((e) => e)
    expect(err).toBeInstanceOf(Warning)
    expect(err.message).toContain('Unable to verify provenance')

    expect(defaultRegistryClient.getManifest).toHaveBeenCalled()
  })

  test('throws Error (provenance regression) when an older semver had dist.attestations but the target does not', async () => {
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

    const packument = {
      name: 'regressionPkg',
      'dist-tags': { latest: '2.0.0' },
      time: {
        '1.0.0': '2023-01-01T00:00:00.000Z',
        '2.0.0': '2023-06-01T00:00:00.000Z'
      },
      versions: {
        '1.0.0': {
          name: 'regressionPkg',
          version: '1.0.0',
          _id: 'regressionPkg@1.0.0',
          dist: {
            integrity: 'sha512-old',
            tarball: 'https://registry.npmjs.org/regressionPkg/-/regressionPkg-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/regressionPkg@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        },
        '2.0.0': {
          name: 'regressionPkg',
          version: '2.0.0',
          _id: 'regressionPkg@2.0.0',
          dist: {
            integrity: 'sha512-new',
            tarball: 'https://registry.npmjs.org/regressionPkg/-/regressionPkg-2.0.0.tgz'
          }
        }
      }
    }

    const mockPackageResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(packument)
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce(mockPackageResponse)

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const pkg = {
      packageName: 'regressionPkg',
      packageVersion: '2.0.0'
    }

    const err = await testMarshall.validate(pkg).catch((e) => e)
    expect(err).not.toBeInstanceOf(Warning)
    expect(err.message).toContain('Provenance regression detected')
    expect(err.message).toContain('1.0.0')
    expect(err.message).toContain('regressionPkg@2.0.0')
  })

  test('prior scan returns null when older semvers exist but none have dist.attestations', async () => {
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

    const packument = {
      name: 'noPriorProv',
      'dist-tags': { latest: '2.0.0' },
      versions: {
        '1.0.0': {
          name: 'noPriorProv',
          version: '1.0.0',
          _id: 'noPriorProv@1.0.0',
          dist: {
            integrity: 'sha512-a',
            tarball: 'https://registry.npmjs.org/noPriorProv/-/noPriorProv-1.0.0.tgz'
          }
        },
        '2.0.0': {
          name: 'noPriorProv',
          version: '2.0.0',
          _id: 'noPriorProv@2.0.0',
          dist: {
            integrity: 'sha512-b',
            tarball: 'https://registry.npmjs.org/noPriorProv/-/noPriorProv-2.0.0.tgz'
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'noPriorProv', packageVersion: '2.0.0' })
      .catch((e) => e)

    expect(err).toBeInstanceOf(Warning)
    expect(err.message).toContain('Unable to verify provenance')
  })

  test('resolves to empty array on malformed checkpoint (#329) when verifyAttestations rejects', async () => {
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

    const packument = {
      name: 'malformedPkg',
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          name: 'malformedPkg',
          version: '1.0.0',
          _id: 'malformedPkg@1.0.0',
          dist: {
            integrity: 'sha512-x',
            tarball: 'https://registry.npmjs.org/malformedPkg/-/malformedPkg-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/malformedPkg@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest.spyOn(NpmRegistry.prototype, 'verifyAttestations').mockRejectedValue(
      Object.assign(new Error('malformed checkpoint in transparency log'), {
        code: 'EATTESTATIONVERIFY'
      })
    )

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const result = await testMarshall.validate({
      packageName: 'malformedPkg',
      packageVersion: '1.0.0'
    })

    expect(result).toEqual([])
  })

  test('does not fetch registry keys when the manifest has no attestations', async () => {
    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () =>
          Promise.resolve({
            name: 'keysFail',
            'dist-tags': { latest: '1.0.0' },
            versions: {
              '1.0.0': {
                name: 'keysFail',
                version: '1.0.0',
                dist: { integrity: 'sha512-x', tarball: 'https://r/k.tgz' }
              }
            }
          }),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'keysFail', packageVersion: '1.0.0' })
      .catch((e) => e)

    expect(err).toBeInstanceOf(Warning)
    expect(err.message).toContain(
      'Unable to verify provenance: the package was published without any attestations'
    )
    expect(defaultRegistryClient.getRegistryKeys).not.toHaveBeenCalled()
  })

  test('throws Error when version cannot be resolved', async () => {
    global.fetch = jest.fn()

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () =>
          Promise.resolve({
            name: 'badRange',
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': { version: '1.0.0' } }
          }),
        parsePackageVersion: () => null
      }
    })

    await expect(
      testMarshall.validate({ packageName: 'badRange', packageVersion: 'not-in-packument' })
    ).rejects.toThrow('Unable to find version or dist-tag for package')
  })

  test('throws Warning when verify succeeds but result has no _attestations', async () => {
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

    const packument = {
      name: 'noAttestField',
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          name: 'noAttestField',
          version: '1.0.0',
          dist: {
            integrity: 'sha512-x',
            tarball: 'https://registry.npmjs.org/noAttestField/-/noAttestField-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/noAttestField@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest.spyOn(NpmRegistry.prototype, 'verifyAttestations').mockResolvedValue({
      name: 'noAttestField',
      version: '1.0.0',
      dist: {}
    })

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'noAttestField', packageVersion: '1.0.0' })
      .catch((e) => e)

    expect(err).toBeInstanceOf(Warning)
    expect(err.message).toContain('the package was published without any attestations')
  })

  test('provenance regression when verifyAttestations fails with EATTESTATIONVERIFY (verify failure)', async () => {
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

    const packument = {
      name: 'verifyFailReg',
      'dist-tags': { latest: '2.0.0' },
      versions: {
        '1.0.0': {
          name: 'verifyFailReg',
          version: '1.0.0',
          _id: 'verifyFailReg@1.0.0',
          dist: {
            integrity: 'sha512-old',
            tarball: 'https://registry.npmjs.org/verifyFailReg/-/verifyFailReg-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/verifyFailReg@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        },
        '2.0.0': {
          name: 'verifyFailReg',
          version: '2.0.0',
          _id: 'verifyFailReg@2.0.0',
          dist: {
            integrity: 'sha512-new',
            tarball: 'https://registry.npmjs.org/verifyFailReg/-/verifyFailReg-2.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/verifyFailReg@2.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest
      .spyOn(NpmRegistry.prototype, 'verifyAttestations')
      .mockRejectedValue(
        Object.assign(new Error('verifyFailReg@2.0.0 failed to verify attestation: sig invalid'), {
          code: 'EATTESTATIONVERIFY'
        })
      )

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'verifyFailReg', packageVersion: '2.0.0' })
      .catch((e) => e)

    expect(err).not.toBeInstanceOf(Warning)
    expect(err.message).toContain('Provenance regression detected')
    expect(err.message).toContain('1.0.0')
  })

  test('provenance regression when verifyAttestations fails with EMISSINGSIGNATUREKEY', async () => {
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

    const packument = {
      name: 'missKeyReg',
      'dist-tags': { latest: '2.0.0' },
      versions: {
        '1.0.0': {
          name: 'missKeyReg',
          version: '1.0.0',
          dist: {
            integrity: 'sha512-old',
            tarball: 'https://registry.npmjs.org/missKeyReg/-/missKeyReg-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/missKeyReg@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        },
        '2.0.0': {
          name: 'missKeyReg',
          version: '2.0.0',
          dist: {
            integrity: 'sha512-new',
            tarball: 'https://registry.npmjs.org/missKeyReg/-/missKeyReg-2.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/missKeyReg@2.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest.spyOn(NpmRegistry.prototype, 'verifyAttestations').mockRejectedValue(
      Object.assign(
        new Error('missKeyReg@2.0.0 has attestations but no corresponding public key'),
        {
          code: 'EMISSINGSIGNATUREKEY'
        }
      )
    )

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'missKeyReg', packageVersion: '2.0.0' })
      .catch((e) => e)

    expect(err).not.toBeInstanceOf(Warning)
    expect(err.message).toContain('Provenance regression detected')
  })

  test('provenance regression when error message includes failed to verify attestation (non-EATTESTATIONVERIFY code)', async () => {
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

    const packument = {
      name: 'failMsgReg',
      'dist-tags': { latest: '2.0.0' },
      versions: {
        '1.0.0': {
          name: 'failMsgReg',
          version: '1.0.0',
          dist: {
            integrity: 'sha512-o',
            tarball: 'https://registry.npmjs.org/failMsgReg/-/failMsgReg-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/failMsgReg@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        },
        '2.0.0': {
          name: 'failMsgReg',
          version: '2.0.0',
          dist: {
            integrity: 'sha512-n',
            tarball: 'https://registry.npmjs.org/failMsgReg/-/failMsgReg-2.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/failMsgReg@2.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest
      .spyOn(NpmRegistry.prototype, 'verifyAttestations')
      .mockRejectedValue(new Error('failMsgReg@2.0.0 failed to verify attestation: custom'))

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'failMsgReg', packageVersion: '2.0.0' })
      .catch((e) => e)

    expect(err).not.toBeInstanceOf(Warning)
    expect(err.message).toContain('Provenance regression detected')
  })

  test('empty error message skips regression consideration (shouldConsiderProvenanceRegression)', async () => {
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

    const packument = {
      name: 'emptyMsg',
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          name: 'emptyMsg',
          version: '1.0.0',
          dist: {
            integrity: 'sha512-x',
            tarball: 'https://registry.npmjs.org/emptyMsg/-/emptyMsg-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/emptyMsg@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest
      .spyOn(NpmRegistry.prototype, 'verifyAttestations')
      .mockRejectedValue(Object.assign(new Error(''), { code: 'EATTESTATIONVERIFY' }))

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'emptyMsg', packageVersion: '1.0.0' })
      .catch((e) => e)

    expect(err).toBeInstanceOf(Warning)
    expect(err.message).toBe('Unable to verify provenance')
  })

  test('generic verify error without regression signal yields Warning', async () => {
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

    const packument = {
      name: 'genericFail',
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          name: 'genericFail',
          version: '1.0.0',
          dist: {
            integrity: 'sha512-x',
            tarball: 'https://registry.npmjs.org/genericFail/-/genericFail-1.0.0.tgz',
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/genericFail@1.0.0',
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' }
            }
          }
        }
      }
    }

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockKeysResponse)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(packument) })

    jest
      .spyOn(NpmRegistry.prototype, 'verifyAttestations')
      .mockRejectedValue(new Error('unexpected registry client failure'))

    const testMarshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: () => Promise.resolve(packument),
        parsePackageVersion: (version) => ({ version })
      }
    })

    const err = await testMarshall
      .validate({ packageName: 'genericFail', packageVersion: '1.0.0' })
      .catch((e) => e)

    expect(err).toBeInstanceOf(Warning)
    expect(err.message).toBe('Unable to verify provenance')
  })

  test('uses the injected registry client for provenance inputs', async () => {
    const packument = {
      name: 'packageName',
      versions: {
        '1.0.0': {
          name: 'packageName',
          version: '1.0.0',
          dist: {
            attestations: {
              url: 'https://registry.npmjs.org/-/npm/v1/attestations/packageName@1.0.0'
            }
          }
        }
      }
    }
    const manifest = packument.versions['1.0.0']
    const attestations = [{ bundle: {} }]
    const keys = [{ keyid: 'key-1' }]
    const registryClient = {
      getManifest: jest.fn().mockResolvedValue(manifest),
      getRegistryKeys: jest.fn().mockResolvedValue(keys),
      getAttestations: jest.fn().mockResolvedValue(attestations)
    }
    const verify = jest
      .spyOn(NpmRegistry.prototype, 'verifyAttestations')
      .mockResolvedValue({ _attestations: {} })
    const marshall = new ProvenanceMarshall({
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

    expect(registryClient.getManifest).toHaveBeenCalledWith(
      'packageName@1.0.0',
      packument
    )
    expect(registryClient.getRegistryKeys).toHaveBeenCalledWith('packageName')
    expect(registryClient.getAttestations).toHaveBeenCalledWith(
      'packageName',
      manifest
    )
    expect(verify).toHaveBeenCalledWith(manifest, keys, attestations)
  })

  test('keeps registry routing bound to the requested package name', async () => {
    const manifest = {
      name: 'response-name',
      version: '1.0.0',
      dist: {
        attestations: {
          url: 'https://registry.npmjs.org/-/npm/v1/attestations/response-name@1.0.0'
        }
      }
    }
    const packument = {
      name: 'response-name',
      versions: { '1.0.0': manifest }
    }
    const registryClient = {
      getManifest: jest.fn().mockResolvedValue(manifest),
      getRegistryKeys: jest.fn().mockResolvedValue([{ keyid: 'key-1' }]),
      getAttestations: jest.fn().mockResolvedValue([{ bundle: {} }])
    }
    jest
      .spyOn(NpmRegistry.prototype, 'verifyAttestations')
      .mockResolvedValue({ _attestations: {} })
    const marshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(packument),
        parsePackageVersion: jest.fn()
      },
      registryClient
    })

    await marshall.validate({
      packageName: '@company/tool',
      packageVersion: '1.0.0'
    })

    expect(registryClient.getManifest).toHaveBeenCalledWith(
      '@company/tool@1.0.0',
      packument
    )
    expect(registryClient.getRegistryKeys).toHaveBeenCalledWith('@company/tool')
    expect(registryClient.getAttestations).toHaveBeenCalledWith(
      '@company/tool',
      manifest
    )
  })

  test.each([
    new NotEvaluated('configured registry does not expose attestations', {
      capability: 'attestations'
    }),
    new RegistryError('Registry authentication failed', {
      registry: 'https://artifactory.example.test/npm/',
      code: 'EREGISTRYAUTH'
    })
  ])('rethrows typed provenance registry failures', async (failure) => {
    const manifest = {
      name: 'packageName',
      version: '1.0.0',
      dist: {
        attestations: {
          url: 'https://registry.npmjs.org/-/npm/v1/attestations/packageName@1.0.0'
        }
      }
    }
    const packument = {
      name: 'packageName',
      versions: { '1.0.0': manifest }
    }
    const marshall = new ProvenanceMarshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(packument),
        parsePackageVersion: jest.fn()
      },
      registryClient: {
        getManifest: jest.fn().mockResolvedValue(manifest),
        getRegistryKeys: jest.fn().mockResolvedValue([]),
        getAttestations: jest.fn().mockRejectedValue(failure)
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
