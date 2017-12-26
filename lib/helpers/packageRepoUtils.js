'use strict'

const axios = require('axios')
const NPM_REGISTRY = `http://registry.npmjs.org`
const NPM_REGISTRY_API = `https://api.npmjs.org`

class PackageRepoUtils {
  constructor (options = {}) {
    this.registryUrl = options.registryUrl ? options.registryUrl : NPM_REGISTRY
    this.registryApiUrl = options.registryApiUrl
      ? options.registryApiUrl
      : NPM_REGISTRY_API
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

  getDownloadInfo (pkg) {
    return axios
      .get(`${this.registryApiUrl}/downloads/point/last-month/${pkg}`)
      .then(response => {
        return response.data['downloads']
      })
  }

  getReadmeInfo (pkg) {
    return axios.get(`${this.registryUrl}/${pkg}`).then(response => {
      return response.data['readme']
    })
  }
}

module.exports = PackageRepoUtils
