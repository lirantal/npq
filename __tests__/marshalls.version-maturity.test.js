'use strict'

const Marshall = require('../lib/marshalls/version-maturity.marshall')

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
})
