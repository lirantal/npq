'use strict'

const BaseMarshall = require('./baseMarshall')
const urlExists = require('url-exists')
const MARSHALL_NAME = 'repo'

class Marshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Identifying package repository...'
  }

  validate (pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then(data => {
      const lastVersionData = data.versions && data.versions[data['dist-tags'].latest]

      if (lastVersionData.repository && lastVersionData.repository.url) {
        const url = lastVersionData.repository.url
        const cleanUrl = 'https:' + url.substring(url.indexOf('//'), url.length)
        urlExists(cleanUrl, (err, exists) => {
          if (!err && !exists) {
            throw new Error(`the repository associated with the package (${cleanUrl}) does not exist or is unreachable at the moment.`)
          }
        })
      } else {
        throw new Error(`the package has no associated repository.`)
      }

      return data
    })
  }
}

module.exports = Marshall
