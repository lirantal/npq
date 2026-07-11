'use strict'

const NpmRegistry = require('../lib/helpers/npmRegistry')
const crypto = require('node:crypto')

// Mock external dependencies
jest.mock('sigstore', () => ({
  verify: jest.fn()
}))

jest.mock('npm-package-arg', () => {
  const actualNpa = jest.requireActual('npm-package-arg')
  return Object.assign(
    (spec) => {
      const result = actualNpa(spec)
      // Handle the case where no version is specified, so it should default to latest
      if (spec === 'express' && result.fetchSpec === '*') {
        result.fetchSpec = 'latest'
      }
      return result
    },
    actualNpa,
    {
      toPurl: jest.fn().mockReturnValue('pkg:npm/express@1.0.0')
    }
  )
})

jest.mock('ssri', () => ({
  parse: jest.fn().mockReturnValue({
    hexDigest: () => 'deadbeef'
  })
}))

describe('NpmRegistry', () => {
  let npmRegistry

  beforeEach(() => {
    jest.clearAllMocks()
    npmRegistry = new NpmRegistry()
  })

  describe('verifySignatures', () => {
    let mockManifest
    let mockRegistryKeys

    beforeEach(() => {
      mockManifest = {
        _id: 'express@1.0.0',
        name: 'express',
        version: '1.0.0',
        _time: '2023-01-01T00:00:00.000Z',
        dist: {
          tarball: 'https://registry.npmjs.org/express/-/express-1.0.0.tgz',
          integrity: 'sha512-example',
          signatures: [
            {
              keyid: 'key1',
              sig: 'signature1'
            }
          ]
        }
      }

      mockRegistryKeys = [
        {
          keyid: 'key1',
          pemkey:
            '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
          expires: '2025-01-01T00:00:00.000Z'
        }
      ]
    })

    test('should verify signatures successfully', async () => {
      // Mock crypto.createVerify
      const mockVerifier = {
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(true)
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerifier)

      const result = await npmRegistry.verifySignatures(mockManifest, mockRegistryKeys)

      expect(crypto.createVerify).toHaveBeenCalledWith('SHA256')
      expect(mockVerifier.write).toHaveBeenCalledWith('express@1.0.0:sha512-example')
      expect(mockVerifier.end).toHaveBeenCalled()
      expect(mockVerifier.verify).toHaveBeenCalledWith(
        mockRegistryKeys[0].pemkey,
        'signature1',
        'base64'
      )
      expect(result._signatures).toEqual(mockManifest.dist.signatures)
    })

    test('should throw error when no signatures exist', async () => {
      const manifestWithoutSigs = { ...mockManifest }
      delete manifestWithoutSigs.dist.signatures

      await expect(
        npmRegistry.verifySignatures(manifestWithoutSigs, mockRegistryKeys)
      ).rejects.toThrow('Package has no signatures to verify')
    })

    test('should throw error when public key not found', async () => {
      const manifestWithDifferentKey = {
        ...mockManifest,
        dist: {
          ...mockManifest.dist,
          signatures: [{ keyid: 'unknown-key', sig: 'signature' }]
        }
      }

      await expect(
        npmRegistry.verifySignatures(manifestWithDifferentKey, mockRegistryKeys)
      ).rejects.toThrow(
        /has a registry signature with keyid: unknown-key but no corresponding public key can be found/
      )
    })

    test('should throw error when public key is expired', async () => {
      const expiredKeys = [
        {
          ...mockRegistryKeys[0],
          expires: '2020-01-01T00:00:00.000Z' // Expired before publish time
        }
      ]

      await expect(npmRegistry.verifySignatures(mockManifest, expiredKeys)).rejects.toThrow(
        /has a registry signature with keyid: key1 but the corresponding public key has expired/
      )
    })

    test('should handle missing time with cutoff date', async () => {
      const manifestWithoutTime = { ...mockManifest }
      delete manifestWithoutTime._time

      const mockVerifier = {
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(true)
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerifier)

      const result = await npmRegistry.verifySignatures(manifestWithoutTime, mockRegistryKeys)
      expect(result._signatures).toEqual(mockManifest.dist.signatures)
    })

    test('should throw error when signature verification fails', async () => {
      const mockVerifier = {
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(false) // Invalid signature
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerifier)

      await expect(npmRegistry.verifySignatures(mockManifest, mockRegistryKeys)).rejects.toThrow(
        /has an invalid registry signature/
      )
    })

    test('should handle public key without expiration', async () => {
      const keysWithoutExpiration = [
        {
          ...mockRegistryKeys[0]
        }
      ]
      delete keysWithoutExpiration[0].expires

      const mockVerifier = {
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(true)
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerifier)

      const result = await npmRegistry.verifySignatures(mockManifest, keysWithoutExpiration)
      expect(result._signatures).toEqual(mockManifest.dist.signatures)
    })

    test('should handle multiple signatures', async () => {
      const manifestWithMultipleSigs = {
        ...mockManifest,
        dist: {
          ...mockManifest.dist,
          signatures: [
            { keyid: 'key1', sig: 'sig1' },
            { keyid: 'key2', sig: 'sig2' }
          ]
        }
      }

      const multipleKeys = [
        mockRegistryKeys[0],
        {
          keyid: 'key2',
          pemkey: '-----BEGIN PUBLIC KEY-----\nDifferentKey...\n-----END PUBLIC KEY-----'
        }
      ]

      const mockVerifier = {
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(true)
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerifier)

      const result = await npmRegistry.verifySignatures(manifestWithMultipleSigs, multipleKeys)
      expect(result._signatures).toEqual(manifestWithMultipleSigs.dist.signatures)
      expect(crypto.createVerify).toHaveBeenCalledTimes(2)
    })
  })

  describe('verifyAttestations', () => {
    let mockManifest
    let mockRegistryKeys
    const sigstore = require('sigstore')

    beforeEach(() => {
      mockManifest = {
        _id: 'express@1.0.0',
        name: 'express',
        version: '1.0.0',
        dist: {
          tarball: 'https://registry.npmjs.org/express/-/express-1.0.0.tgz',
          integrity: 'sha512-example',
          attestations: {
            url: 'http://registry.npmjs.org/-/npm/v1/attestations/express@1.0.0'
          }
        }
      }

      mockRegistryKeys = [
        {
          keyid: 'key1',
          pemkey:
            '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----'
        }
      ]
    })

    test('should throw error when no attestations exist', async () => {
      const manifestWithoutAttestations = { ...mockManifest }
      delete manifestWithoutAttestations.dist.attestations

      await expect(
        npmRegistry.verifyAttestations(manifestWithoutAttestations, mockRegistryKeys)
      ).rejects.toThrow('Package has no attestations to verify')
    })

    test('should verify supplied attestations successfully', async () => {
      // Mock the statement payload with matching hex digest
      const correctHexDigest = require('ssri').parse(mockManifest.dist.integrity).hexDigest()
      const statement = {
        subject: [
          {
            name: 'pkg:npm/express@1.0.0',
            digest: {
              sha512: correctHexDigest
            }
          }
        ]
      }

      const mockAttestations = {
        attestations: [
          {
            predicateType: 'https://slsa.dev/provenance/v0.2',
            bundle: {
              dsseEnvelope: {
                payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
                signatures: [
                  {
                    keyid: 'key1',
                    sig: 'signature1'
                  }
                ]
              },
              verificationMaterial: {
                tlogEntries: [
                  {
                    integratedTime: '1640995200' // 2022-01-01
                  }
                ]
              }
            }
          }
        ]
      }

      // Mock sigstore verification
      sigstore.verify.mockResolvedValue()

      const result = await npmRegistry.verifyAttestations(
        mockManifest,
        mockRegistryKeys,
        mockAttestations.attestations
      )
      expect(result._attestations).toEqual(mockManifest.dist.attestations)
    })

    test('should reject an invalid attestations response', async () => {
      await expect(
        npmRegistry.verifyAttestations(mockManifest, mockRegistryKeys, null)
      ).rejects.toThrow('Package attestations response is invalid')
    })

    test('should throw error when no corresponding public key found', async () => {
      const mockAttestations = {
        attestations: [
          {
            predicateType: 'https://slsa.dev/provenance/v0.2',
            bundle: {
              dsseEnvelope: {
                payload: Buffer.from(JSON.stringify({})).toString('base64'),
                signatures: [
                  {
                    keyid: 'unknown-key',
                    sig: 'signature1'
                  }
                ]
              }
            }
          }
        ]
      }

      await expect(
        npmRegistry.verifyAttestations(mockManifest, [], mockAttestations.attestations)
      ).rejects.toThrow(/has attestations but no corresponding public key\(s\) can be found/)
    })

    test('should handle attestation verification failure', async () => {
      // Mock the statement payload with matching hex digest
      const correctHexDigest = require('ssri').parse(mockManifest.dist.integrity).hexDigest()
      const statement = {
        subject: [
          {
            name: 'pkg:npm/express@1.0.0',
            digest: { sha512: correctHexDigest }
          }
        ]
      }

      const mockAttestations = {
        attestations: [
          {
            predicateType: 'https://slsa.dev/provenance/v0.2',
            bundle: {
              dsseEnvelope: {
                payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
                signatures: [
                  {
                    keyid: 'key1',
                    sig: 'signature1'
                  }
                ]
              },
              verificationMaterial: {
                tlogEntries: [{ integratedTime: '1640995200' }]
              }
            }
          }
        ]
      }

      // Mock sigstore verification failure
      sigstore.verify.mockRejectedValue(new Error('Verification failed'))

      await expect(
        npmRegistry.verifyAttestations(
          mockManifest,
          mockRegistryKeys,
          mockAttestations.attestations
        )
      ).rejects.toThrow(/failed to verify attestation: Verification failed/)
    })
  })
})
