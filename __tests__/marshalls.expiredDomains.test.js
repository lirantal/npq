'use strict'

const ExpiredDomainsMarshall = require('../lib/marshalls/expiredDomains.marshall')
const NotEvaluated = require('../lib/helpers/notEvaluated')

const testMarshall = new ExpiredDomainsMarshall({
  packageRepoUtils: {
    getPackageInfo: (pkgInfo) => {
      return new Promise((resolve) => {
        resolve(pkgInfo)
      })
    }
  }
})

describe('Expired domains test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  test('has the right title', async () => {
    expect(testMarshall.title()).toEqual('Detecting expired domains for authors account...')
  })

  test('throws the right error when an email domain cant be verified', async () => {
    const nonExistentEmailAddress =
      'liran.tal+test1234@somenonexistentdomainongoogle109dubv98g39ujasdasda.com'
    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            maintainers: [
              { name: 'lirantal', email: 'liran.tal@gmail.com' },
              {
                name: 'lirantal_test_user',
                email: nonExistentEmailAddress
              }
            ]
          }
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(
      /Detected expired domain can be abused for account takeover/
    )
  })

  test('if email hostname is empty then show an unknown message', async () => {
    const nonExistentEmailAddress = ''
    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            maintainers: [
              { name: 'lirantal', email: 'liran.tal@gmail.com' },
              {
                name: 'lirantal_test_user',
                email: nonExistentEmailAddress
              }
            ]
          }
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(
      /Detected expired domain can be abused for account takeover: <unknown>/
    )
  })

  test('is not evaluated when the latest version has no maintainers data', async () => {
    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(NotEvaluated)
  })

  test('is not evaluated when the maintainers list is empty', async () => {
    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            maintainers: []
          }
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(NotEvaluated)
  })

  test('is not evaluated when the package data has no versions', async () => {
    const pkgData = {
      packageName: {}
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(NotEvaluated)
  })

  test('does not throw any errors if the domain resolves well', async () => {
    jest.setTimeout(15000)

    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            maintainers: [
              { name: 'lirantal', email: 'liran.tal@gmail.com' },
              {
                name: 'lirantal_test_user',
                email: 'liran.tal@gmail.com'
              }
            ]
          }
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).resolves.toEqual(expect.anything())
  })
})
