'use strict'

const ExpiredDomainsMarshall = require('../lib/marshalls/expiredDomains.marshall')
const NotEvaluated = require('../lib/helpers/notEvaluated')
const { RegistryError } = require('../lib/helpers/registryErrors')
const Warning = require('../lib/helpers/warning')

function packageData(maintainers) {
  return {
    'dist-tags': { latest: '1.0.0' },
    versions: {
      '1.0.0': { maintainers }
    }
  }
}

function dnsFailure(code, hostname = 'example.com') {
  return Object.assign(new Error(code), { code, hostname })
}

function createMarshall({ getPackageInfo, resolve } = {}) {
  return new ExpiredDomainsMarshall({
    packageRepoUtils: {
      getPackageInfo: getPackageInfo || (async (pkgInfo) => pkgInfo)
    },
    dnsResolver: {
      resolve: resolve || jest.fn().mockResolvedValue(['ns1.example.com'])
    }
  })
}

describe('Expired domains test suites', () => {
  test('has the right title', () => {
    expect(createMarshall().title()).toEqual('Detecting expired domains for authors account...')
  })

  test('preserves registry errors', async () => {
    const failure = new RegistryError('Registry network request failed', {
      registry: 'https://registry.example.test/',
      code: 'EREGISTRYNETWORK'
    })
    const testMarshall = createMarshall({
      getPackageInfo: jest.fn().mockRejectedValue(failure)
    })

    await expect(testMarshall.validate({ packageName: 'example' })).rejects.toBe(failure)
  })

  test.each([
    ['missing email', { name: 'maintainer' }],
    ['empty email', { name: 'maintainer', email: '' }],
    ['email without a domain', { name: 'maintainer', email: 'dev@' }],
    ['email with whitespace in its domain', { name: 'maintainer', email: 'dev@example .com' }]
  ])('is not evaluated for a %s', async (_name, maintainer) => {
    const resolve = jest.fn()
    const testMarshall = createMarshall({ resolve })

    await expect(testMarshall.validate({ packageName: packageData([maintainer]) })).rejects.toThrow(
      NotEvaluated
    )
    expect(resolve).not.toHaveBeenCalled()
  })

  test.each([
    ['latest version has no maintainers data', packageData(undefined)],
    ['maintainers list is empty', packageData([])],
    ['package data has no versions', {}]
  ])('is not evaluated when the %s', async (_name, data) => {
    const testMarshall = createMarshall()

    await expect(testMarshall.validate({ packageName: data })).rejects.toThrow(NotEvaluated)
  })

  test('reports NXDOMAIN as a warning instead of an error', async () => {
    const resolve = jest.fn().mockRejectedValue(dnsFailure('ENOTFOUND', 'missing-domain.com'))
    const testMarshall = createMarshall({ resolve })

    await expect(
      testMarshall.validate({
        packageName: packageData([{ name: 'maintainer', email: 'dev@missing-domain.com' }])
      })
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: Warning,
        message:
          'Maintainer domain missing-domain.com does not resolve in public DNS and may warrant investigation.'
      })
    )
  })

  test.each(['ENODATA', 'ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED', 'EBADRESP', 'UNKNOWN'])(
    'reports %s DNS failures as not evaluated',
    async (code) => {
      const resolve = jest.fn().mockRejectedValue(dnsFailure(code))
      const testMarshall = createMarshall({ resolve })

      await expect(
        testMarshall.validate({
          packageName: packageData([{ name: 'maintainer', email: 'dev@example.com' }])
        })
      ).rejects.toThrow(NotEvaluated)
    }
  )

  test('records NXDOMAIN through the marshall warning channel', async () => {
    const resolve = jest.fn().mockRejectedValue(dnsFailure('ENOTFOUND', 'missing-domain.com'))
    const testMarshall = createMarshall({ resolve })
    const ctx = { pkgs: [], marshalls: {} }
    testMarshall.init(ctx)

    await testMarshall.checkPackage(
      {
        packageName: packageData([{ name: 'maintainer', email: 'dev@missing-domain.com' }]),
        packageString: 'example-package'
      },
      ctx
    )

    expect(ctx.marshalls.maintainers_expired_emails.errors).toEqual([])
    expect(ctx.marshalls.maintainers_expired_emails.warnings).toEqual([
      expect.objectContaining({
        pkg: 'example-package',
        message: expect.stringContaining('does not resolve in public DNS')
      })
    ])
  })

  test('orders suspected domains and reports other incomplete records', async () => {
    const resolve = jest.fn(async (domain) => {
      if (domain === 'a-domain.com' || domain === 'b-domain.com') {
        throw dnsFailure('ENOTFOUND', domain)
      }
      if (domain === 'timeout-domain.com') {
        throw dnsFailure('ETIMEOUT', domain)
      }
      return ['ns1.example.com']
    })
    const testMarshall = createMarshall({ resolve })

    await expect(
      testMarshall.validate({
        packageName: packageData([
          { name: 'b', email: 'dev@b-domain.com' },
          { name: 'invalid', email: '' },
          { name: 'timeout', email: 'dev@timeout-domain.com' },
          { name: 'a', email: 'dev@a-domain.com' }
        ])
      })
    ).rejects.toThrow(
      'Maintainer domains a-domain.com, b-domain.com do not resolve in public DNS and may warrant investigation. 2 other maintainer records could not be evaluated.'
    )
  })

  test('queries the registrable ICANN domain instead of the mail subdomain', async () => {
    const resolve = jest.fn().mockResolvedValue(['ns1.example.com'])
    const testMarshall = createMarshall({ resolve })

    await testMarshall.validate({
      packageName: packageData([{ name: 'maintainer', email: 'dev@MAIL.Example.CO.UK.' }])
    })

    expect(resolve).toHaveBeenCalledWith('example.co.uk', 'NS')
  })

  test('evaluates public ICANN domains from custom-registry metadata', async () => {
    const resolve = jest.fn().mockResolvedValue(['ns1.example.com'])
    const testMarshall = createMarshall({ resolve })
    const data = {
      ...packageData([{ name: 'maintainer', email: 'dev@mail.example.com' }]),
      _registry: 'https://registry.example.test/'
    }

    await expect(testMarshall.validate({ packageName: data })).resolves.toEqual([
      ['ns1.example.com']
    ])
    expect(resolve).toHaveBeenCalledWith('example.com', 'NS')
  })

  test('is not evaluated when custom-registry metadata has only internal domains', async () => {
    const resolve = jest.fn()
    const testMarshall = createMarshall({ resolve })
    const data = {
      ...packageData([{ name: 'maintainer', email: 'dev@packages.corp' }]),
      _registry: 'https://registry.example.test/'
    }

    await expect(testMarshall.validate({ packageName: data })).rejects.toThrow(NotEvaluated)
    expect(resolve).not.toHaveBeenCalled()
  })

  test('deduplicates maintainer domains before resolving them', async () => {
    const resolve = jest.fn().mockResolvedValue(['ns1.example.com'])
    const testMarshall = createMarshall({ resolve })

    await expect(
      testMarshall.validate({
        packageName: packageData([
          { name: 'first', email: 'first@Example.COM' },
          { name: 'second', email: 'second@example.com' }
        ])
      })
    ).resolves.toEqual([['ns1.example.com']])
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith('example.com', 'NS')
  })

  test('counts incomplete DNS results by affected maintainer record', async () => {
    const resolve = jest.fn().mockRejectedValue(dnsFailure('ETIMEOUT'))
    const testMarshall = createMarshall({ resolve })

    await expect(
      testMarshall.validate({
        packageName: packageData([
          { name: 'first', email: 'first@example.com' },
          { name: 'second', email: 'second@example.com' }
        ])
      })
    ).rejects.toThrow(
      '2 maintainer records could not be evaluated because DNS or email data was incomplete'
    )
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  test('resolves without live network access when every unique domain resolves', async () => {
    const resolve = jest.fn().mockResolvedValue(['ns1.example.com'])
    const testMarshall = createMarshall({ resolve })

    await expect(
      testMarshall.validate({
        packageName: packageData([
          { name: 'first', email: 'first@example.com' },
          { name: 'second', email: 'second@example.org' }
        ])
      })
    ).resolves.toEqual([['ns1.example.com'], ['ns1.example.com']])
    expect(resolve).toHaveBeenCalledTimes(2)
  })
})
