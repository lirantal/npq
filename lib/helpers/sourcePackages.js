'use strict'

const path = require('node:path')
const fs = require('node:fs/promises')

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
          return `${dep}@${packageData.dependencies[dep]}`
        })
      ]
    }
    if (packageData && packageData.devDependencies) {
      packages = [
        ...packages,
        ...Object.keys(packageData.devDependencies).map((dep) => {
          return `${dep}@${packageData.devDependencies[dep]}`
        })
      ]
    }

    return packages
  } catch (error) {
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
