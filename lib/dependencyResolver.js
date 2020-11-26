const { resolve } = require('path')

const MAX_PARENT_FOLDER_DEPTH = 5

class dependencyResolver {
  static resolvePackageJson () {
    let depth = 0
    let path = 'package.json'
    let packageJson

    while (!packageJson && depth <= MAX_PARENT_FOLDER_DEPTH) {
      try {
        packageJson = require(resolve(path))
      } catch (err) {
        depth += 1
        path = `../${path}`
      }
    }

    if (depth > MAX_PARENT_FOLDER_DEPTH) {
      throw new Error('No `package.json` file found in the current folder or its parents. Are you running this in a Node project?')
    }

    return packageJson
  }

  static getDependencies (packageJson, { noDev = false }) {
    const getDepList = (depObj) => {
      const dependencies = []
      //  deepcode ignore guard-for-in: <depObj's prototype is just Object, no unwanted properties possible>
      for (const name in depObj) {
        dependencies.push(`${name}@${depObj[name]}`)
      }
      return dependencies
    }

    let dependencies = getDepList(packageJson.dependencies || {})
    if (!noDev) dependencies = dependencies.concat(getDepList(packageJson.devDependencies || {}))
    return dependencies
  }
}

module.exports = dependencyResolver
