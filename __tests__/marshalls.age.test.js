'use strict'

const Marshall = require('../lib/marshalls/age.marshall')

describe('Age Marshall', () => {
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
        ).rejects.toThrow('Detected a newly published package (created < 22 days) act carefully')
    })

    test('should throw error for package created exactly at threshold boundary (22 days - 1 millisecond)', async () => {
        const now = Date.now()
        const almostThreshold = new Date(now - 22 * 24 * 60 * 60 * 1000 + 1) // 21 days, 23 hours, 59 minutes, 59 seconds, 999 milliseconds ago

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
        ).rejects.toThrow('Detected a newly published package (created < 22 days) act carefully')
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
        ).rejects.toThrow('Detected an old package (created 1 years ago)')
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
        ).rejects.toThrow('Detected a newly published package (created < 22 days) act carefully')
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
        ).rejects.toThrow('Detected a newly published package (created < 22 days) act carefully')
    })
})
