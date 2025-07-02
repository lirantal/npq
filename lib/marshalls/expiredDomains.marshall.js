'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')
const { Resolver } = require('dns/promises')

const dns = new Resolver()
dns.setServers(['1.1.1.1', '8.8.8.8'])
const MARSHALL_NAME = 'maintainers_expired_emails'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
  }

  title() {
    return 'Detecting expired domains for authors account...'
  }

  validate(pkg) {
    return this.packageRepoUtils
      .getPackageInfo(pkg.packageName)
      .then((data) => {
        const lastVersionData =
          data.versions && data['dist-tags'] && data.versions[data['dist-tags'].latest]

        const maintainersAccounts = lastVersionData && lastVersionData.maintainers

        const testEmails = []
        for (const maintainerInfo of maintainersAccounts) {
          const maintainerEmail = maintainerInfo.email
          const emailDomain = maintainerEmail.split('@')[1]
          testEmails.push(dns.resolve(emailDomain, 'NS'))
        }

        return Promise.all(testEmails)
      })
      .catch((error) => {
        const emailHostname = error.hostname ? error.hostname : '<unknown>'
        throw new Error(
          'Unable to resolve domain for maintainer e-mail, could be an expired account: ' +
            emailHostname
        )
      })
  }
}

module.exports = Marshall
