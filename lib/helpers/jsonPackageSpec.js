'use strict'

const { parseRegistryPackageSpec } = require('./registryPackageSpec')

function parseJsonRegistryPackageSpec(packageSpec) {
  try {
    return parseRegistryPackageSpec(packageSpec)
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
