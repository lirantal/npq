'use strict'

const BaseMarshall = require('./baseMarshall')
const { marshallCategories } = require('./constants')
const { Resolver } = require('dns/promises')

const dns = new Resolver()
dns.setServers(['1.1.1.1', '8.8.8.8'])
const MARSHALL_NAME = 'maintainers_expired_emails'
const EMAIL_DOMAIN_REGEX = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/
const DOMAIN_RECORD_TYPES = ['NS', 'MX', 'SOA']
const DOMAIN_NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA'])

function getDomainFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return null
  }

  const match = email.trim().match(EMAIL_DOMAIN_REGEX)
  if (!match) {
    return null
  }

  return match[1].toLowerCase().replace(/\.$/, '')
}

function formatMaintainerDomainFinding(maintainer, domain) {
  const name = maintainer.name || '<unknown>'
  const email = maintainer.email || '<unknown>'
  return `${name} <${email}> uses ${domain}`
}

function hasDnsRecords(value) {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  return Boolean(value)
}

class Marshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = MARSHALL_NAME
    this.categoryId = marshallCategories.PackageHealth.id
    this.dns = options.dnsResolver || dns
  }

  title() {
    return 'Detecting expired domains for authors account...'
  }

  async isExpiredDomainRisk(domain) {
    const lookupResults = await Promise.allSettled(
      DOMAIN_RECORD_TYPES.map((recordType) => this.dns.resolve(domain, recordType))
    )

    const hasEvidenceOfExistingDomain = lookupResults.some((result) => {
      return result.status === 'fulfilled' && hasDnsRecords(result.value)
    })
    if (hasEvidenceOfExistingDomain) {
      return false
    }

    return lookupResults.every((result) => {
      return result.status === 'rejected' && DOMAIN_NOT_FOUND_CODES.has(result.reason.code)
    })
  }

  async validate(pkg) {
    const data = await this.packageRepoUtils.getPackageInfo(pkg.packageName)
    const packageVersion = await this.packageRepoUtils.getSemVer(
      pkg.packageName,
      pkg.packageVersion
    )
    const versionData = data.versions && data.versions[packageVersion]
    const maintainersAccounts =
      versionData && Array.isArray(versionData.maintainers) ? versionData.maintainers : []

    const maintainersByDomain = new Map()
    for (const maintainerInfo of maintainersAccounts) {
      const emailDomain = getDomainFromEmail(maintainerInfo.email)
      if (!emailDomain) {
        this.debug(
          '\nSkipping expired-domain lookup for maintainer with missing or invalid e-mail: %o',
          maintainerInfo
        )
        continue
      }

      if (!maintainersByDomain.has(emailDomain)) {
        maintainersByDomain.set(emailDomain, [])
      }
      maintainersByDomain.get(emailDomain).push(maintainerInfo)
    }

    const domainResults = await Promise.all(
      Array.from(maintainersByDomain.keys()).map(async (domain) => {
        return {
          domain,
          isExpiredDomainRisk: await this.isExpiredDomainRisk(domain)
        }
      })
    )

    const findings = []
    for (const { domain, isExpiredDomainRisk } of domainResults) {
      if (!isExpiredDomainRisk) {
        continue
      }

      this.debug('\nDetected expired-domain risk for maintainer e-mail domain: %s', domain)
      for (const maintainerInfo of maintainersByDomain.get(domain)) {
        findings.push(formatMaintainerDomainFinding(maintainerInfo, domain))
      }
    }

    if (findings.length > 0) {
      throw new Error(
        'Detected expired domains that can be abused for account takeover: ' + findings.join('; ')
      )
    }
  }
}

module.exports = Marshall
