'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')
const NotEvaluated = require('../helpers/notEvaluated')
const Warning = require('../helpers/warning')
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

    const emailDomains = new Map()
    let invalidMaintainers = 0
    for (const maintainerInfo of maintainersAccounts) {
      const maintainerEmail = maintainerInfo && maintainerInfo.email
      const atIndex = typeof maintainerEmail === 'string' ? maintainerEmail.lastIndexOf('@') : -1
      const emailDomain =
        atIndex > 0
          ? maintainerEmail
              .slice(atIndex + 1)
              .trim()
              .toLowerCase()
          : ''

      if (!emailDomain || emailDomain.includes('@') || /\s/.test(emailDomain)) {
        invalidMaintainers += 1
        continue
      }

      emailDomains.set(emailDomain, (emailDomains.get(emailDomain) || 0) + 1)
    }

    if (emailDomains.size === 0) {
      throw new NotEvaluated('no valid maintainer email domains are available for the package')
    }

    const domains = [...emailDomains.keys()].sort()
    const resolutionResults = await Promise.allSettled(
      domains.map((emailDomain) => this.dnsResolver.resolve(emailDomain, 'NS'))
    )
    const suspectedDomains = []
    const incompleteDomains = []

    resolutionResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        return
      }

      const domain = domains[index]
      const errorCode = result.reason && result.reason.code
      this.debug(
        '\nUnable to resolve maintainer email domain %s with code %s',
        domain,
        errorCode || '<unknown>'
      )

      if (errorCode === 'ENOTFOUND') {
        suspectedDomains.push(domain)
      } else {
        incompleteDomains.push(domain)
      }
    })

    const incompleteCount =
      invalidMaintainers +
      incompleteDomains.reduce((count, domain) => count + emailDomains.get(domain), 0)
    if (suspectedDomains.length > 0) {
      const domainNoun = suspectedDomains.length === 1 ? 'domain' : 'domains'
      const resolveVerb = suspectedDomains.length === 1 ? 'does' : 'do'
      let message = `Maintainer ${domainNoun} ${suspectedDomains.join(', ')} ${resolveVerb} not resolve in public DNS and may warrant investigation.`

      if (incompleteCount > 0) {
        const recordNoun = incompleteCount === 1 ? 'record' : 'records'
        message += ` ${incompleteCount} other maintainer ${recordNoun} could not be evaluated.`
      }

      throw new Warning(message)
    }

    if (incompleteCount > 0) {
      const recordNoun = incompleteCount === 1 ? 'record' : 'records'
      throw new NotEvaluated(
        `${incompleteCount} maintainer ${recordNoun} could not be evaluated because DNS or email data was incomplete`
      )
    }

    return resolutionResults.map((result) => result.value)
  }
}

module.exports = Marshall
