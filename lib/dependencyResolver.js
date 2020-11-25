const { resolve } = require('path')

const MAX_PARENT_FOLDER_DEPTH = 5;

class DependencyResolver {
  packageJson = null
  dependencies = []

  resolvePackageJson () {
    let depth = 0
    let path = 'package.json'

    while (!this.packageJson && depth <= MAX_PARENT_FOLDER_DEPTH) {
      let packageJson;
      try {
        packageJson = require(resolve(path))
      } catch (err) {
        depth += 1
        path = `../${path}`
      }

      if (packageJson) this.packageJson = packageJson
    }

    if (depth > MAX_PARENT_FOLDER_DEPTH) {
      throw new Error('No `package.json` file found in the current folder or its parents. Are you running this in a Node project?')
    }
  }

  getDependencies ({ noDev = false }) {
    const getDepList = (depObj) => {
      const dependencies = []
      for (const [name, version] of Object.entries(depObj)) {
        dependencies.push(`${name}@${version}`)
      }
      return dependencies
    }
    this.dependencies = getDepList(this.packageJson.dependencies || {})
    if (!noDev) this.dependencies = this.dependencies.concat(getDepList(this.packageJson.devDependencies || {}))
  }
}

module.exports = DependencyResolver
