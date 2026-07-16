'use strict'

const ExpiredDomainsMarshall = require('../lib/marshalls/expiredDomains.marshall')
const NotEvaluated = require('../lib/helpers/notEvaluated')
const { RegistryError } = require('../lib/helpers/registryErrors')

function packageData(maintainers) {
  return {
    'dist-tags': { latest: '1.0.0' },
    versions: {
      '1.0.0': { maintainers }
    }
  }
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

  test('isolates DNS failures from package metadata retrieval', async () => {
    const failure = Object.assign(new Error('not found'), {
      hostname: 'missing.example'
    })
    const resolve = jest.fn().mockRejectedValue(failure)
    const testMarshall = createMarshall({ resolve })

    await expect(
      testMarshall.validate({
        packageName: packageData([{ name: 'maintainer', email: 'dev@missing.example' }])
      })
    ).rejects.toThrow('Detected expired domain can be abused for account takeover: missing.example')
    expect(resolve).toHaveBeenCalledWith('missing.example', 'NS')
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

  test('checks valid emails but reports mixed maintainer data as not evaluated', async () => {
    const resolve = jest.fn().mockResolvedValue(['ns1.example.com'])
    const testMarshall = createMarshall({ resolve })

    await expect(
      testMarshall.validate({
        packageName: packageData([
          { name: 'valid', email: 'dev@example.com' },
          { name: 'invalid', email: '' }
        ])
      })
    ).rejects.toThrow('1 maintainer email address is missing or malformed')
    expect(resolve).toHaveBeenCalledWith('example.com', 'NS')
  })

  test.each([
    ['latest version has no maintainers data', packageData(undefined)],
    ['maintainers list is empty', packageData([])],
    ['package data has no versions', {}]
  ])('is not evaluated when the %s', async (_name, data) => {
    const testMarshall = createMarshall()

    await expect(testMarshall.validate({ packageName: data })).rejects.toThrow(NotEvaluated)
  })

  test('resolves without live network access when every domain resolves', async () => {
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
