'use strict'

const Marshall = require('../lib/marshalls/age.marshall')
const FIXED_NOW = new Date('2025-01-01T00:00:00.000Z')

describe('Age Marshall', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW)
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  test('should have the correct title', () => {
    const testMarshall = new Marshall({
      packageRepoUtils: null
    })

    expect(testMarshall.title()).toEqual('Checking package maturity')
  })

  test('should throw error for newly published package (within 22 days threshold)', async () => {
    const now = Date.now()
    const daysAgo15 = new Date(now - 15 * 24 * 60 * 60 * 1000) // 15 days ago (within threshold)

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: daysAgo15.toISOString(),
              '1.0.0': daysAgo15.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
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
    ).rejects.toThrow('Detected a newly published package: created < 22 days. Act carefully')
  })

  test('should throw error for package created just within threshold boundary (22 days - 1 second)', async () => {
    const now = Date.now()
    // Create a date that's definitely within the threshold by using a larger margin
    const almostThreshold = new Date(now - (22 * 24 * 60 * 60 * 1000 - 1000)) // 21 days, 23 hours, 59 minutes, 59 seconds ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: almostThreshold.toISOString(),
              '1.0.0': almostThreshold.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
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
    ).rejects.toThrow('Detected a newly published package: created < 22 days. Act carefully')
  })

  test('should handle exact millisecond boundary calculation correctly', async () => {
    // This test uses a fixed reference time to avoid timing issues
    const referenceTime = new Date('2025-08-26T12:00:00.000Z').getTime()
    const exactlyTwentyTwoDaysAgo = new Date(referenceTime - 22 * 24 * 60 * 60 * 1000)
    const justUnderTwentyTwoDaysAgo = new Date(referenceTime - (22 * 24 * 60 * 60 * 1000 - 1))

    // Mock Date.now() to return our reference time
    const originalNow = Date.now
    Date.now = jest.fn(() => referenceTime)

    try {
      // Test: exactly 22 days should pass
      const testMarshallExact = new Marshall({
        packageRepoUtils: {
          getPackageInfo: () =>
            Promise.resolve({
              time: {
                created: exactlyTwentyTwoDaysAgo.toISOString(),
                '1.0.0': exactlyTwentyTwoDaysAgo.toISOString()
              },
              'dist-tags': { latest: '1.0.0' }
            }),
          parsePackageVersion: (version) => ({ version })
        }
      })

      await expect(
        testMarshallExact.validate({
          packageName: 'test-package-exact',
          packageVersion: '1.0.0'
        })
      ).resolves.toBeUndefined()

      // Test: just under 22 days should fail
      const testMarshallUnder = new Marshall({
        packageRepoUtils: {
          getPackageInfo: () =>
            Promise.resolve({
              time: {
                created: justUnderTwentyTwoDaysAgo.toISOString(),
                '1.0.0': justUnderTwentyTwoDaysAgo.toISOString()
              },
              'dist-tags': { latest: '1.0.0' }
            }),
          parsePackageVersion: (version) => ({ version })
        }
      })

      await expect(
        testMarshallUnder.validate({
          packageName: 'test-package-under',
          packageVersion: '1.0.0'
        })
      ).rejects.toThrow('Detected a newly published package: created < 22 days. Act carefully')
    } finally {
      // Restore original Date.now
      Date.now = originalNow
    }
  })

  test('should pass for package created exactly at threshold (22 days)', async () => {
    const now = Date.now()
    const exactThreshold = new Date(now - 22 * 24 * 60 * 60 * 1000) // exactly 22 days ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: exactThreshold.toISOString(),
              '1.0.0': exactThreshold.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    // Should not throw - package is old enough
    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).resolves.toBeUndefined()
  })

  test('should pass for package created well beyond threshold (30 days)', async () => {
    const now = Date.now()
    const daysAgo30 = new Date(now - 30 * 24 * 60 * 60 * 1000) // 30 days ago (well beyond threshold)

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: daysAgo30.toISOString(),
              '1.0.0': daysAgo30.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    // Should not throw - package is old enough
    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).resolves.toBeUndefined()
  })

  test('should throw error for very old package (beyond 365 days unmaintained threshold)', async () => {
    const now = new Date()
    const veryOld = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000) // 400 days ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: veryOld.toISOString(),
              '1.0.0': veryOld.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
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
    ).rejects.toThrow('Detected an old package: created 1 years ago')
  })

  test('should throw warning when package data is missing time.created', async () => {
    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            // Missing time.created
            'dist-tags': {
              latest: '1.0.0'
            }
          })
        }
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow('Could not determine package age')
  })

  test('should throw warning when package data is completely missing', async () => {
    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve(null)
        }
      }
    })

    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow('Could not determine package age')
  })

  test('should verify date difference calculation uses milliseconds correctly', async () => {
    // This test specifically validates the fix where we convert days to milliseconds
    const now = Date.now()

    // Create a package that's exactly 21.5 days old (should trigger the error)
    const exactlyHalfwayBelowThreshold = new Date(now - 21.5 * 24 * 60 * 60 * 1000)

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: exactlyHalfwayBelowThreshold.toISOString(),
              '1.0.0': exactlyHalfwayBelowThreshold.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    // Should throw because 21.5 days < 22 days threshold
    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow('Detected a newly published package: created < 22 days. Act carefully')
  })

  test('should handle edge case of package created in the future (clock skew)', async () => {
    const now = Date.now()
    const futureDate = new Date(now + 24 * 60 * 60 * 1000) // 1 day in the future

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: futureDate.toISOString(),
              '1.0.0': futureDate.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    // Future packages should trigger the new package warning
    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow('Detected a newly published package: created < 22 days. Act carefully')
  })

  test('should verify unmaintained package calculation uses milliseconds correctly', async () => {
    // This test validates that the unmaintained package check also uses millisecond precision
    const now = Date.now()

    // Create a package version that's exactly 365.5 days old (should trigger the warning)
    const exactlyOverUnmaintainedThreshold = new Date(now - 365.5 * 24 * 60 * 60 * 1000)
    // Package creation date is old enough to pass the new package check
    const packageCreationDate = new Date(now - 400 * 24 * 60 * 60 * 1000) // 400 days ago

    const testMarshall = new Marshall({
      packageRepoUtils: {
        getPackageInfo: () => {
          return Promise.resolve({
            time: {
              created: packageCreationDate.toISOString(),
              '1.0.0': exactlyOverUnmaintainedThreshold.toISOString()
            },
            'dist-tags': {
              latest: '1.0.0'
            }
          })
        },
        parsePackageVersion: (version) => ({ version })
      }
    })

    // Should throw because 365.5 days > 365 days unmaintained threshold
    await expect(
      testMarshall.validate({
        packageName: 'test-package',
        packageVersion: '1.0.0'
      })
    ).rejects.toThrow('Detected an old package: created 1 years ago')
  })
})
