'use strict'

const npa = require('npm-package-arg')

const REGISTRY_SPEC_TYPES = new Set(['tag', 'version', 'range'])
const UNSUPPORTED_PACKAGE_SPEC = 'EUNSUPPORTEDPACKAGESPEC'

function parseRegistryPackageSpec(packageSpec, packageName) {
  let parsedPackage
  try {
    if (typeof packageSpec !== 'string') throw new Error('Invalid package spec')
    parsedPackage =
      packageName === undefined ? npa(packageSpec) : npa.resolve(packageName, packageSpec)
    if (!parsedPackage.name || !REGISTRY_SPEC_TYPES.has(parsedPackage.type)) {
      throw new Error('Unsupported package spec')
    }
    return parsedPackage
  } catch {
    // Parser errors can include credentials or private paths from the input.
    const name = parsedPackage?.name ? `: ${JSON.stringify(parsedPackage.name)}` : ''
    const error = new Error(
      `Only registry package specifiers are supported (names, versions, ranges, and tags)${name}`
    )
    error.code = UNSUPPORTED_PACKAGE_SPEC
    throw error
  }
}

module.exports = { parseRegistryPackageSpec, UNSUPPORTED_PACKAGE_SPEC }
