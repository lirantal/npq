'use strict'

const Marshall = require('../lib/marshalls/version-maturity.marshall')

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('Version Maturity Marshall', () => {
  test('should have the correct title', () => {
    const testMarshall = new Marshall({
      packageRepoUtils: null
    })

    expect(testMarshall.title()).toEqual('Checking version maturity')
  })

  test('should throw error for recently published version (same day)', async () => {
    const now = new Date()
    const hoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            'dist-tags': {
              latest: '1.0.0'
            },
            time: {
              '1.0.0': hoursAgo.toISOString()
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow(
      'Detected a recently published version: published 2 hours ago. Consider waiting for community review.'
    )
  })

  test('should throw error for recently published version (within threshold)', async () => {
    const now = new Date()
    const daysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            'dist-tags': {
              latest: '1.0.0'
            },
            time: {
              '1.0.0': daysAgo.toISOString()
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow(
      'Detected a recently published version: published 3 days ago. Consider waiting for community review.'
    )
  })

  test('should throw error for version published exactly 1 day ago', async () => {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 1 day ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            'dist-tags': {
              latest: '1.0.0'
            },
            time: {
              '1.0.0': oneDayAgo.toISOString()
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow(
      'Detected a recently published version: published 1 day ago. Consider waiting for community review.'
    )
  })

  test('should pass for version published beyond threshold', async () => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) // 8 days ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            'dist-tags': {
              latest: '1.0.0'
            },
            time: {
              '1.0.0': weekAgo.toISOString()
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    const result = await testMarshall.validate({
      packageName: 'test-package',
      packageVersion: '1.0.0'
    })

    expect(result).toEqual({
      packageName: 'test-package',
      packageVersion: '1.0.0'
    })
  })

  test('should throw error when package time information is missing', async () => {
    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({})
        },
        getSemVer: () => Promise.resolve('1.0.0')
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow('Could not determine package version information')
  })

  test('should throw error when version release date is missing', async () => {
    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            'dist-tags': {
              latest: '1.0.0'
            },
            time: {
              '2.0.0': new Date().toISOString()
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow('Could not determine release date for version 1.0.0')
  })

  test('should handle version aliases correctly', async () => {
    const now = new Date()
    const daysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            'dist-tags': {
              latest: '1.2.3'
            },
            time: {
              '1.2.3': daysAgo.toISOString()
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: 'latest'
      })
    ).rejects.toThrow(
      'Detected a recently published version: published 2 days ago. Consider waiting for community review.'
    )
  })

  test('attaches an older stable release suggestion for latest', async () => {
    const packageInfo = {
      'dist-tags': { latest: '2.0.0' },
      versions: {
        '1.5.0': { version: '1.5.0' },
        '2.0.0-beta.1': { version: '2.0.0-beta.1' },
        '2.0.0': { version: '2.0.0' }
      },
      time: {
        '1.5.0': daysAgo(40),
        '2.0.0-beta.1': daysAgo(45),
        '2.0.0': daysAgo(2)
      }
    }
    const marshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(packageInfo),
        parsePackageVersion: (version) => ({ version })
      }
    })

    await expect(
      marshall.validate({
        packageName: 'test-package',
        packageVersion: 'latest',
        packageString: 'test-package@latest'
      })
    ).rejects.toMatchObject({
      suggestion: {
        type: 'alternative-version',
        packageName: 'test-package',
        version: '1.5.0',
        packageSpec: 'test-package@1.5.0',
        publishedAt: packageInfo.time['1.5.0'],
        ageDays: 40,
        reason: 'version-recency'
      }
    })
  })

  test('keeps an alternative suggestion inside a requested semver range', async () => {
    const packageInfo = {
      versions: {
        '1.9.9': { version: '1.9.9' },
        '2.0.0': { version: '2.0.0' },
        '2.2.0': { version: '2.2.0' }
      },
      time: {
        '1.9.9': daysAgo(35),
        '2.0.0': daysAgo(40),
        '2.2.0': daysAgo(2)
      }
    }
    const marshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(packageInfo),
        parsePackageVersion: (version) => ({ version })
      }
    })

    await expect(
      marshall.validate({
        packageName: 'test-package',
        packageVersion: '^2.0.0',
        packageString: 'test-package@^2.0.0'
      })
    ).rejects.toMatchObject({
      suggestion: expect.objectContaining({
        version: '2.0.0',
        packageSpec: 'test-package@2.0.0'
      })
    })
  })

  test('does not attach a suggestion when no older release clears the recency window', async () => {
    const packageInfo = {
      'dist-tags': { latest: '2.0.0' },
      versions: {
        '1.0.0': { version: '1.0.0' },
        '2.0.0': { version: '2.0.0' }
      },
      time: {
        '1.0.0': daysAgo(20),
        '2.0.0': daysAgo(2)
      }
    }
    const marshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockResolvedValue(packageInfo),
        parsePackageVersion: (version) => ({ version })
      }
    })

    let error
    try {
      await marshall.validate({
        packageName: 'test-package',
        packageVersion: 'latest',
        packageString: 'test-package@latest'
      })
    } catch (caughtError) {
      error = caughtError
    }

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe(
      'Detected a recently published version: published 2 days ago. Consider waiting for community review.'
    )
    expect(error.suggestion).toBeUndefined()
  })
})
