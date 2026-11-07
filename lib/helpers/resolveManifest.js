'use strict'

const npa = require('npm-package-arg')
const pickManifest = require('npm-pick-manifest')
const { RegistryError } = require('./registryErrors')

// Selection must follow npm's spec classification and manifest preferences. In
// particular, a semver-shaped dist-tag must never override a version or range.
function resolveManifest(packageName, versionSpec, packument, options = {}) {
  try {
    if (typeof versionSpec !== 'string' || versionSpec.trim() === '') {
      throw new Error('Missing version specification')
    }
    const spec = npa.resolve(packageName, versionSpec)
    if (!['version', 'range', 'tag'].includes(spec.type)) {
      throw new Error('Only registry versions, ranges, and tags can be audited')
    }
    if (!packument || !packument.versions) {
      throw new Error('Missing package versions')
    }

    // npm-pick-manifest normalizes bin fields in place. Keep the cached
    // packument unchanged so every marshall sees the original metadata.
    const manifest = pickManifest(
      structuredClone({ ...packument, name: packageName }),
      spec.fetchSpec,
      options
    )
    if (!manifest.version || !packument.versions[manifest.version]) {
      throw new Error('Selected manifest has no matching package version')
    }
    return manifest
  } catch (cause) {
    throw new RegistryError(`Unable to resolve version ${versionSpec} for package ${packageName}`, {
      code: 'EREGISTRYRESOLVE',
      cause
    })
  }
}

module.exports = resolveManifest
