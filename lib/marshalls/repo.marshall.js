'use strict'

const BaseMarshall = require('./baseMarshall')
const axios = require('axios')
const MARSHALL_NAME = 'repo'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title() {
    return 'Identifying package repository...'
  }

  validate(pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then(data => {
      const lastVersionData = (data.versions && data['dist-tags'] && data['dist-tags'].latest &&
        data.versions[data['dist-tags'].latest]) || data
      if (lastVersionData && lastVersionData.repository && lastVersionData.repository.url) {
        return axios.get(lastVersionData.repository.url)
          .catch(() => {
            throw new Error(`the repository associated with the package (${lastVersionData.repository.url}) does not exist or is unreachable at the moment.`)
          })
      } else if (lastVersionData && lastVersionData.homepage) {
        return axios.get(lastVersionData.homepage)
          .catch(() => {
            throw new Error(`the homepage associated with the package (${lastVersionData.homepage}) does not exist or is unreachable at the moment.`)
          })
      } else {
        throw new Error(`the package has no associated repository or homepage.`)
      }
    })
  }
}

module.exports = Marshall
