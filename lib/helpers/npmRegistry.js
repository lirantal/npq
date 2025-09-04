'use strict'

const crypto = require('node:crypto')
const npa = require('npm-package-arg')
const sigstore = require('sigstore')
const ssri = require('ssri')

// Some really old packages have no time field so we need a cutoff date
const MISSING_TIME_CUTOFF = '2015-01-01T00:00:00.000Z'

/**
 * Helper class to interact with npm registry and verify package signatures/attestations
 * This replaces pacote functionality for npq specific needs
 */
class NpmRegistry {
  constructor(opts = {}) {
    this.opts = opts
    this.registry = opts.registry || 'https://registry.npmjs.org'
  }

  /**
   * Fetch package manifest from npm registry
   * @param {string} packageSpec - Package name and version (e.g., 'express@4.18.2')
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Package manifest
   */
  async getManifest(packageSpec, options = {}) {
    const spec = npa(packageSpec)
    const escapedName = spec.escapedName
    const packumentUrl = `${this.registry}/${escapedName}`

    // Fetch packument (package metadata)
    const response = await fetch(packumentUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'npq-npm-registry-client',
        ...(options.headers || {})
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch package manifest: ${response.status} ${response.statusText}`)
    }

    const packument = await response.json()

    // Pick the specific version
    let version = spec.fetchSpec
    if (version === 'latest' || !version) {
      version = packument['dist-tags']?.latest
    }

    if (!packument.versions || !packument.versions[version]) {
      throw new Error(`Version ${version} not found for package ${spec.name}`)
    }

    const manifest = packument.versions[version]

    // Add timing information if available
    if (packument.time && packument.time[version]) {
      manifest._time = packument.time[version]
    }

    return manifest
  }

  /**
   * Verify package signatures using npm registry public keys
   * @param {Object} manifest - Package manifest
   * @param {Array} registryKeys - Public keys from npm registry
   * @returns {Promise<Object>} Verified manifest with _signatures
   */
  async verifySignatures(manifest, registryKeys) {
    if (!manifest.dist || !manifest.dist.signatures) {
      throw new Error('Package has no signatures to verify')
    }

    const signatures = manifest.dist.signatures
    const message = `${manifest._id}:${manifest.dist.integrity}`

    for (const signature of signatures) {
      const publicKey = registryKeys.find((key) => key.keyid === signature.keyid)

      if (!publicKey) {
        throw Object.assign(
          new Error(
            `${manifest._id} has a registry signature with keyid: ${signature.keyid} ` +
              'but no corresponding public key can be found'
          ),
          { code: 'EMISSINGSIGNATUREKEY' }
        )
      }

      const publishedTime = Date.parse(manifest._time || MISSING_TIME_CUTOFF)
      const validPublicKey = !publicKey.expires || publishedTime < Date.parse(publicKey.expires)

      if (!validPublicKey) {
        throw Object.assign(
          new Error(
            `${manifest._id} has a registry signature with keyid: ${signature.keyid} ` +
              `but the corresponding public key has expired ${publicKey.expires}`
          ),
          { code: 'EEXPIREDSIGNATUREKEY' }
        )
      }

      const verifier = crypto.createVerify('SHA256')
      verifier.write(message)
      verifier.end()

      const valid = verifier.verify(publicKey.pemkey, signature.sig, 'base64')

      if (!valid) {
        throw Object.assign(
          new Error(
            `${manifest._id} has an invalid registry signature with ` +
              `keyid: ${publicKey.keyid} and signature: ${signature.sig}`
          ),
          {
            code: 'EINTEGRITYSIGNATURE',
            keyid: publicKey.keyid,
            signature: signature.sig,
            resolved: manifest.dist.tarball,
            integrity: manifest.dist.integrity
          }
        )
      }
    }

    // Add verified signatures to manifest
    return {
      ...manifest,
      _signatures: signatures
    }
  }

  /**
   * Verify package attestations/provenance using sigstore
   * @param {Object} manifest - Package manifest
   * @param {Array} registryKeys - Public keys from npm registry
   * @returns {Promise<Object>} Verified manifest with _attestations
   */
  async verifyAttestations(manifest, registryKeys) {
    if (!manifest.dist || !manifest.dist.attestations) {
      throw new Error('Package has no attestations to verify')
    }

    const attestationsPath = new URL(manifest.dist.attestations.url).pathname
    const attestationsUrl = this.registry + attestationsPath

    const response = await fetch(attestationsUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'npq-npm-registry-client'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch attestations: ${response.status} ${response.statusText}`)
    }

    const { attestations } = await response.json()

    const bundles = attestations.map(({ predicateType, bundle }) => {
      const statement = JSON.parse(
        Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString('utf8')
      )
      const keyid = bundle.dsseEnvelope.signatures[0].keyid
      const signature = bundle.dsseEnvelope.signatures[0].sig

      return {
        predicateType,
        bundle,
        statement,
        keyid,
        signature
      }
    })

    const attestationKeyIds = bundles.map((b) => b.keyid).filter((k) => !!k)
    const attestationRegistryKeys = registryKeys.filter((key) =>
      attestationKeyIds.includes(key.keyid)
    )

    if (!attestationRegistryKeys.length) {
      throw Object.assign(
        new Error(
          `${manifest._id} has attestations but no corresponding public key(s) can be found`
        ),
        { code: 'EMISSINGSIGNATUREKEY' }
      )
    }

    for (const { predicateType, bundle, keyid, signature, statement } of bundles) {
      const publicKey = attestationRegistryKeys.find((key) => key.keyid === keyid)

      // Publish attestations have a keyid set and a valid public key must be found
      if (keyid) {
        if (!publicKey) {
          throw Object.assign(
            new Error(
              `${manifest._id} has attestations with keyid: ${keyid} ` +
                'but no corresponding public key can be found'
            ),
            { code: 'EMISSINGSIGNATUREKEY' }
          )
        }

        const integratedTime = new Date(
          Number(bundle.verificationMaterial.tlogEntries[0].integratedTime) * 1000
        )
        const validPublicKey = !publicKey.expires || integratedTime < Date.parse(publicKey.expires)

        if (!validPublicKey) {
          throw Object.assign(
            new Error(
              `${manifest._id} has attestations with keyid: ${keyid} ` +
                `but the corresponding public key has expired ${publicKey.expires}`
            ),
            { code: 'EEXPIREDSIGNATUREKEY' }
          )
        }
      }

      const subject = {
        name: statement.subject[0].name,
        sha512: statement.subject[0].digest.sha512
      }

      // Parse package spec to create PURL for comparison
      const spec = npa(`${manifest.name}@${manifest.version}`)
      const purl = npa.toPurl(spec)

      // Verify the statement subject matches the package, version
      if (subject.name !== purl) {
        throw Object.assign(
          new Error(
            `${manifest._id} package name and version (PURL): ${purl} ` +
              `doesn't match what was signed: ${subject.name}`
          ),
          { code: 'EATTESTATIONSUBJECT' }
        )
      }

      // Verify the statement subject matches the tarball integrity
      const integrityHexDigest = ssri.parse(manifest.dist.integrity).hexDigest()
      if (subject.sha512 !== integrityHexDigest) {
        throw Object.assign(
          new Error(
            `${manifest._id} package integrity (hex digest): ` +
              `${integrityHexDigest} ` +
              `doesn't match what was signed: ${subject.sha512}`
          ),
          { code: 'EATTESTATIONSUBJECT' }
        )
      }

      try {
        // Provenance attestations are signed with a signing certificate
        // Publish attestations are signed with a keyid so we need to specify a public key
        const options = {
          keySelector: publicKey ? () => publicKey.pemkey : undefined
        }
        await sigstore.verify(bundle, options)
      } catch (e) {
        throw Object.assign(
          new Error(`${manifest._id} failed to verify attestation: ${e.message}`),
          {
            code: 'EATTESTATIONVERIFY',
            predicateType,
            keyid,
            signature,
            resolved: manifest.dist.tarball,
            integrity: manifest.dist.integrity
          }
        )
      }
    }

    // Add verified attestations to manifest
    return {
      ...manifest,
      _attestations: manifest.dist.attestations
    }
  }
}

module.exports = NpmRegistry
