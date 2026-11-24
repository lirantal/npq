'use strict'

const path = require('node:path')
const fs = require('node:fs/promises')
const { parseRegistryPackageSpec, UNSUPPORTED_PACKAGE_SPEC } = require('./registryPackageSpec')

async function getProjectPackages() {
  const currentDirectory = process.cwd()

  const packageJSONPath = path.join(currentDirectory, 'package.json')
  try {
    let packages = []
    const packageJSON = await fs.readFile(packageJSONPath, 'utf-8')
    const packageData = JSON.parse(packageJSON)
    for (const section of ['dependencies', 'devDependencies']) {
      if (!packageData || !Object.hasOwn(packageData, section)) continue
      const dependencies = packageData[section]
      if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
        return {
          error: true,
          message: `Invalid package.json ${section}: expected an object mapping package names to specifiers`
        }
      }
      packages = packages.concat(
        Object.entries(dependencies).map(([name, spec], index) => {
          try {
            const parsed = parseRegistryPackageSpec(spec, name)
            return `${parsed.name}@${parsed.fetchSpec}`
          } catch (error) {
            error.message += ` (package.json ${section}, entry ${index + 1})`
            throw error
          }
        })
      )
    }

    return packages
  } catch (error) {
    if (error.code === UNSUPPORTED_PACKAGE_SPEC) {
      return { error: true, code: error.code, message: error.message }
    }

    let errorMessage = ''
    if (error.code === 'ENOENT') {
      errorMessage = `No package.json found in ${currentDirectory}`
    } else {
      errorMessage = `Error reading package.json: ${error.message}`
    }

    return {
      error: true,
      message: errorMessage
    }
  }
}

module.exports = {
  getProjectPackages
}
