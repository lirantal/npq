'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')
const NotEvaluated = require('../helpers/notEvaluated')
const { Resolver } = require('dns/promises')

const dns = new Resolver()
dns.setServers(['1.1.1.1', '8.8.8.8'])
const MARSHALL_NAME = 'maintainers_expired_emails'

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
    this.dnsResolver = options.dnsResolver || dns
  }

  title() {
    return 'Detecting expired domains for authors account...'
  }

  async validate(pkg) {
    const data = await this.packageRepoUtils.getPackageInfo(pkg.packageName)
    const lastVersionData =
      data.versions && data['dist-tags'] && data.versions[data['dist-tags'].latest]

    const maintainersAccounts = lastVersionData && lastVersionData.maintainers

    if (!Array.isArray(maintainersAccounts) || maintainersAccounts.length === 0) {
      throw new NotEvaluated('no maintainers information available for the package')
    }

    const emailDomains = []
    let invalidMaintainers = 0
    for (const maintainerInfo of maintainersAccounts) {
      const maintainerEmail = maintainerInfo && maintainerInfo.email
      const atIndex = typeof maintainerEmail === 'string' ? maintainerEmail.lastIndexOf('@') : -1
      const emailDomain = atIndex > 0 ? maintainerEmail.slice(atIndex + 1).trim() : ''

      if (!emailDomain || emailDomain.includes('@') || /\s/.test(emailDomain)) {
        invalidMaintainers += 1
        continue
      }

      emailDomains.push(emailDomain)
    }

    if (emailDomains.length === 0) {
      throw new NotEvaluated('no valid maintainer email domains are available for the package')
    }

    let resolutionResults
    try {
      resolutionResults = await Promise.all(
        emailDomains.map((emailDomain) => this.dnsResolver.resolve(emailDomain, 'NS'))
      )
    } catch (error) {
      const emailHostname = error.hostname ? error.hostname : '<unknown>'
      this.debug('\nDetected error resolving domain for maintainer e-mail: %s', emailHostname)
      throw new Error(
        'Detected expired domain can be abused for account takeover: ' + emailHostname
      )
    }

    if (invalidMaintainers > 0) {
      const noun = invalidMaintainers === 1 ? 'address is' : 'addresses are'
      throw new NotEvaluated(`${invalidMaintainers} maintainer email ${noun} missing or malformed`)
    }

    return resolutionResults
  }
}

module.exports = Marshall
