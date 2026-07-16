'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')
const NotEvaluated = require('../helpers/notEvaluated')
const Warning = require('../helpers/warning')
const {
  isSimpleMaintainerDomain,
  normalizeMaintainerDomain
} = require('../helpers/maintainerDomain')
const { defaultRdapClient, rdapStatuses } = require('../helpers/rdapClient')
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
    this.rdapClient = options.rdapClient || defaultRdapClient
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
      const emailDomain = normalizeMaintainerDomain(maintainerInfo && maintainerInfo.email)

      if (!emailDomain) {
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
    const simpleMissingDomains = []
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

      if (errorCode === 'ENOTFOUND' && isSimpleMaintainerDomain(domain)) {
        simpleMissingDomains.push(domain)
      } else {
        incompleteDomains.push(domain)
      }
    })

    const topLevelDomains = [
      ...new Set(simpleMissingDomains.map((domain) => domain.split('.')[1]))
    ].sort()
    const topLevelResults = await Promise.allSettled(
      topLevelDomains.map((domain) => this.dnsResolver.resolve(domain, 'NS'))
    )
    const publicTopLevelDomains = new Set()

    topLevelResults.forEach((result, index) => {
      const domain = topLevelDomains[index]
      if (result.status === 'fulfilled') {
        publicTopLevelDomains.add(domain)
        return
      }

      this.debug(
        '\nUnable to verify public top-level domain %s with code %s',
        domain,
        (result.reason && result.reason.code) || '<unknown>'
      )
    })

    const rdapCandidateDomains = simpleMissingDomains.filter((domain) => {
      const isPublic = publicTopLevelDomains.has(domain.split('.')[1])
      if (!isPublic) {
        incompleteDomains.push(domain)
      }
      return isPublic
    })
    const rdapResults = await Promise.allSettled(
      rdapCandidateDomains.map((domain) => this.rdapClient.lookup(domain))
    )
    const corroboratedDomains = []

    rdapResults.forEach((result, index) => {
      const domain = rdapCandidateDomains[index]
      if (result.status === 'rejected' || !result.value) {
        incompleteDomains.push(domain)
        return
      }

      if (result.value.status === rdapStatuses.NotFound) {
        corroboratedDomains.push(domain)
      } else if (result.value.status !== rdapStatuses.Registered) {
        incompleteDomains.push(domain)
      }
    })

    const incompleteCount =
      invalidMaintainers +
      incompleteDomains.reduce((count, domain) => count + emailDomains.get(domain), 0)
    if (corroboratedDomains.length > 0) {
      const domainNoun = corroboratedDomains.length === 1 ? 'domain' : 'domains'
      const resolveVerb = corroboratedDomains.length === 1 ? 'does' : 'do'
      let message = `Maintainer ${domainNoun} ${corroboratedDomains.join(', ')} ${resolveVerb} not resolve in public DNS, and RDAP found no active registration; account takeover may be possible.`

      if (incompleteCount > 0) {
        const recordNoun = incompleteCount === 1 ? 'record' : 'records'
        message += ` ${incompleteCount} other maintainer ${recordNoun} could not be evaluated.`
      }

      throw new Warning(message)
    }

    if (incompleteCount > 0) {
      const recordNoun = incompleteCount === 1 ? 'record' : 'records'
      throw new NotEvaluated(
        `${incompleteCount} maintainer ${recordNoun} could not be evaluated because DNS, RDAP, or email data was incomplete`
      )
    }

    return resolutionResults.map((result) => result.value)
  }
}

module.exports = Marshall
