'use strict'

const ExpiredDomainsMarshall = require('../lib/marshalls/expiredDomains.marshall')

function createMarshall(pakument, resolver, resolvedVersion = '1.0.0') {
  return new ExpiredDomainsMarshall({
    packageRepoUtils: {
      getPackageInfo: jest.fn().mockResolvedValue(pakument),
      getSemVer: jest.fn().mockResolvedValue(resolvedVersion)
    },
    dnsResolver: resolver
  })
}

function createResolver(recordsByDomain = {}) {
  return {
    resolve: jest.fn((domain, recordType) => {
      const records = recordsByDomain[domain]

      if (records && Object.hasOwn(records, recordType)) {
        const value = records[recordType]
        if (value instanceof Error) {
          return Promise.reject(value)
        }
        return Promise.resolve(value)
      }

      const error = new Error(`query${recordType} ENOTFOUND ${domain}`)
      error.code = 'ENOTFOUND'
      error.hostname = domain
      return Promise.reject(error)
    })
  }
}

function pakumentWithMaintainers(maintainersByVersion) {
  return {
    'dist-tags': {
      latest: '2.0.0'
    },
    versions: Object.fromEntries(
      Object.entries(maintainersByVersion).map(([version, maintainers]) => {
        return [
          version,
          {
            version,
            maintainers
          }
        ]
      })
    )
  }
}

describe('Expired domains test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  test('has the right title', async () => {
    const testMarshall = createMarshall(pakumentWithMaintainers({ '1.0.0': [] }), createResolver())

    expect(testMarshall.title()).toEqual('Detecting expired domains for authors account...')
  })

  test('reports all maintainers whose domains look expired', async () => {
    const pakument = pakumentWithMaintainers({
      '1.0.0': [
        { name: 'alice', email: 'alice@example.com' },
        { name: 'bob', email: 'bob@expired.test' },
        { name: 'carol', email: 'carol@also-expired.test' }
      ]
    })
    const resolver = createResolver({
      'example.com': {
        NS: ['ns1.example.com'],
        MX: [{ exchange: 'mail.example.com', priority: 10 }],
        SOA: { nsname: 'ns1.example.com' }
      }
    })
    const testMarshall = createMarshall(pakument, resolver)

    await expect(
      testMarshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).rejects.toThrow(
      'Detected expired domains that can be abused for account takeover: bob <bob@expired.test> uses expired.test; carol <carol@also-expired.test> uses also-expired.test'
    )
  })

  test('deduplicates DNS checks while reporting each maintainer on a failed domain', async () => {
    const pakument = pakumentWithMaintainers({
      '1.0.0': [
        { name: 'alice', email: 'alice@expired.test' },
        { name: 'bob', email: 'bob@expired.test' }
      ]
    })
    const resolver = createResolver()
    const testMarshall = createMarshall(pakument, resolver)

    await expect(
      testMarshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).rejects.toThrow(
      'alice <alice@expired.test> uses expired.test; bob <bob@expired.test> uses expired.test'
    )

    expect(resolver.resolve).toHaveBeenCalledTimes(3)
    expect(resolver.resolve).toHaveBeenCalledWith('expired.test', 'NS')
    expect(resolver.resolve).toHaveBeenCalledWith('expired.test', 'MX')
    expect(resolver.resolve).toHaveBeenCalledWith('expired.test', 'SOA')
  })

  test('checks the resolved package version rather than always checking latest', async () => {
    const pakument = pakumentWithMaintainers({
      '1.0.0': [{ name: 'old-maintainer', email: 'old@expired.test' }],
      '2.0.0': [{ name: 'new-maintainer', email: 'new@example.com' }]
    })
    const resolver = createResolver({
      'example.com': {
        NS: ['ns1.example.com']
      }
    })
    const testMarshall = createMarshall(pakument, resolver, '1.0.0')

    await expect(
      testMarshall.validate({ packageName: 'pkg', packageVersion: '^1.0.0' })
    ).rejects.toThrow('old-maintainer <old@expired.test> uses expired.test')

    expect(resolver.resolve).not.toHaveBeenCalledWith('example.com', expect.any(String))
  })

  test('does not flag a domain when any DNS record type proves it exists', async () => {
    const noDataError = new Error('queryNs ENODATA mail-only.test')
    noDataError.code = 'ENODATA'
    noDataError.hostname = 'mail-only.test'

    const pakument = pakumentWithMaintainers({
      '1.0.0': [{ name: 'alice', email: 'alice@mail-only.test' }]
    })
    const resolver = createResolver({
      'mail-only.test': {
        NS: noDataError,
        MX: [{ exchange: 'mail.mail-only.test', priority: 10 }],
        SOA: noDataError
      }
    })
    const testMarshall = createMarshall(pakument, resolver)

    await expect(
      testMarshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).resolves.toBeUndefined()
  })

  test('does not flag indeterminate DNS failures as expired-domain risk', async () => {
    const timeoutError = new Error('queryNs ETIMEOUT flaky.test')
    timeoutError.code = 'ETIMEOUT'
    timeoutError.hostname = 'flaky.test'

    const pakument = pakumentWithMaintainers({
      '1.0.0': [{ name: 'alice', email: 'alice@flaky.test' }]
    })
    const resolver = createResolver({
      'flaky.test': {
        NS: timeoutError,
        MX: timeoutError,
        SOA: timeoutError
      }
    })
    const testMarshall = createMarshall(pakument, resolver)

    await expect(
      testMarshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).resolves.toBeUndefined()
  })

  test('skips missing and malformed maintainer emails without crashing', async () => {
    const pakument = pakumentWithMaintainers({
      '1.0.0': [
        { name: 'missing' },
        { name: 'malformed', email: 'not-an-email' },
        { name: 'valid', email: 'valid@example.com' }
      ]
    })
    const resolver = createResolver({
      'example.com': {
        SOA: { nsname: 'ns1.example.com' }
      }
    })
    const testMarshall = createMarshall(pakument, resolver)

    await expect(
      testMarshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).resolves.toBeUndefined()

    expect(resolver.resolve).toHaveBeenCalledTimes(3)
    expect(resolver.resolve).toHaveBeenCalledWith('example.com', 'NS')
    expect(resolver.resolve).toHaveBeenCalledWith('example.com', 'MX')
    expect(resolver.resolve).toHaveBeenCalledWith('example.com', 'SOA')
  })
})
