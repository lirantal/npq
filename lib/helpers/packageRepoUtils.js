'use strict'

const axios = require('axios')
const NPM_REGISTRY = `http://registry.npmjs.org`

class PackageRepoUtils {
  constructor (options = {}) {
    this.registryUrl = options.registryUrl ? options.registryUrl : NPM_REGISTRY
  }

  getPackageInfo (pkg) {
    return axios.get(`${this.registryUrl}/${pkg}`).then(response => {
      return response.data
    })
  }

  getLatestVersion (pkg) {
    return axios.get(`${this.registryUrl}/${pkg}`).then(response => {
      return response.data['dist-tags']['latest']
    })
  }
}

module.exports = PackageRepoUtils
