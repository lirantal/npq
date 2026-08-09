'use strict'

const npa = require('npm-package-arg')

const JSON_REGISTRY_SPEC_TYPES = new Set(['tag', 'version', 'range'])

function parseJsonRegistryPackageSpec(packageSpec) {
  try {
    const parsedPackage = npa(packageSpec)
    if (!parsedPackage.name || !JSON_REGISTRY_SPEC_TYPES.has(parsedPackage.type)) {
      throw new Error('Unsupported package spec')
    }

    return parsedPackage
  } catch {
    throw new Error('Invalid JSON package input')
  }
}

function isJsonRegistryPackageSpec(packageSpec) {
  try {
    parseJsonRegistryPackageSpec(packageSpec)
    return true
  } catch {
    return false
  }
}

module.exports = { isJsonRegistryPackageSpec, parseJsonRegistryPackageSpec }
