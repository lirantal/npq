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
    if (packageData && packageData.dependencies) {
      packages = [
        ...packages,
        ...Object.keys(packageData.dependencies).map((dep) => {
          const parsed = parseRegistryPackageSpec(packageData.dependencies[dep], dep)
          return `${parsed.name}@${parsed.fetchSpec}`
        })
      ]
    }
    if (packageData && packageData.devDependencies) {
      packages = [
        ...packages,
        ...Object.keys(packageData.devDependencies).map((dep) => {
          const parsed = parseRegistryPackageSpec(packageData.devDependencies[dep], dep)
          return `${parsed.name}@${parsed.fetchSpec}`
        })
      ]
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
