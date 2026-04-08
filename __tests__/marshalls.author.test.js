'use strict'

const Marshall = require('../lib/marshalls/author.marshall')
const Warning = require('../lib/helpers/warning')

const DEFAULT_EMAIL = 'alice@example.com'

function npmUser(name = 'Alice', email = DEFAULT_EMAIL) {
  return { name, email }
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Mocks used by Author Marshall (matches PackageRepoUtils surface).
 * Object key order in `versions` is preserved — Author Marshall uses Object.values order for
 * “first version for this user”.
 */
function createMarshall(pakument, resolvedVersion) {
  const version = resolvedVersion ?? '1.0.0'
  return new Marshall({
    packageRepoUtils: {
      getPackageInfo: jest.fn().mockResolvedValue(pakument),
      getSemVer: jest.fn().mockResolvedValue(version)
    }
  })
}

describe('Author Marshall', () => {
  test('should have the correct title', () => {
    const marshall = createMarshall({ versions: {}, time: {} })
    expect(marshall.title()).toEqual('Identifying package author...')
  })

  test('should throw when publishing user is missing', async () => {
    const pakument = {
      versions: {
        '1.0.0': {}
      },
      time: {
        '1.0.0': daysAgo(100)
      }
    }
    const marshall = createMarshall(pakument)
    await expect(
      marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).rejects.toThrow('Could not determine publishing user for this package version')
  })

  test('should throw when publishing user has no email', async () => {
    const pakument = {
      versions: {
        '1.0.0': { _npmUser: { name: 'NoEmail' } }
      },
      time: {
        '1.0.0': daysAgo(100)
      }
    }
    const marshall = createMarshall(pakument)
    await expect(
      marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).rejects.toThrow('Could not determine publishing user for this package version')
  })

  test('should throw when publishing user email fails validation', async () => {
    const pakument = {
      versions: {
        '1.0.0': { _npmUser: npmUser('Bad', 'not-an-email') }
      },
      time: {
        '1.0.0': daysAgo(100)
      }
    }
    const marshall = createMarshall(pakument)
    await expect(
      marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
    ).rejects.toThrow('The publishing user has no valid email address')
  })

  describe('new author check (first publish for this email on this package)', () => {
    test('should error when the only version is the user first publish and within 21 days', async () => {
      const published = daysAgo(5)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Bob', 'bob@example.com') }
        },
        time: {
          '1.0.0': published
        }
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).rejects.toThrow(
        'The user Bob <bob@example.com> published this package for the first time only 5 days ago'
      )
    })

    test('should not error for single old first publish (mature sole version)', async () => {
      const published = daysAgo(4000)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Carol', 'carol@example.com') }
        },
        time: {
          '1.0.0': published
        }
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).resolves.toBe(published)
    })

    test('should error at exactly 21 days for first publish', async () => {
      const published = daysAgo(21)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Dan', 'dan@example.com') }
        },
        time: {
          '1.0.0': published
        }
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).rejects.toThrow(/published this package for the first time only 21 days ago/)
    })

    test('should ignore version entries without _npmUser when finding first publish for email', async () => {
      const published = daysAgo(10)
      const pakument = {
        versions: {
          '0.5.0': { version: '0.5.0' },
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Frank', 'frank@example.com') }
        },
        time: {
          '0.5.0': daysAgo(5000),
          '1.0.0': published
        }
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).rejects.toThrow(
        /Frank <frank@example.com> published this package for the first time only 10 days ago/
      )
    })

    test('should not apply new-author error when an older version from same email exists first in versions map', async () => {
      // Keep inter-release gap < ~6 months so dormant maintainer check does not fire before recency
      const oldRelease = daysAgo(100)
      const newRelease = daysAgo(5)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser() },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser() }
        },
        time: {
          '1.0.0': oldRelease,
          '2.0.0': newRelease
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(`This version was published only 5 days ago by Alice <${DEFAULT_EMAIL}>`)
    })
  })

  describe('dormant maintainer check', () => {
    test('does not flag when there is no prior publish by the same email', async () => {
      const published = daysAgo(80)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Zed', 'zed@example.com') },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser('Yve', 'yve@example.com') }
        },
        time: {
          '1.0.0': daysAgo(500),
          '2.0.0': published
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).resolves.toBe(published)
    })

    test('throws Warning when gap is over 6 months (~184 days) and version is outside recency window', async () => {
      const prior = daysAgo(284)
      const current = daysAgo(100)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Mia', 'mia@example.com') },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser('Mia', 'mia@example.com') }
        },
        time: {
          '1.0.0': prior,
          '2.0.0': current
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(Warning)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(
        /Mia <mia@example.com> had not published this package for 184 days before this release \(more than 6 months dormant\)/
      )
    })

    test('throws Error when gap is over 9 months (~275 days) and version is outside recency window', async () => {
      const prior = daysAgo(375)
      const current = daysAgo(100)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Noa', 'noa@example.com') },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser('Noa', 'noa@example.com') }
        },
        time: {
          '1.0.0': prior,
          '2.0.0': current
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(
        /Noa <noa@example.com> had not published this package for 275 days before this release \(more than 9 months dormant\)/
      )
    })

    test('does not flag when inter-release gap is exactly 183 days (strict boundary)', async () => {
      const prior = daysAgo(283)
      const current = daysAgo(100)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Pia', 'pia@example.com') },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser('Pia', 'pia@example.com') }
        },
        time: {
          '1.0.0': prior,
          '2.0.0': current
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).resolves.toBe(current)
    })

    test('Warning only when gap is exactly 274 days (strict boundary for 9-month error)', async () => {
      const prior = daysAgo(324)
      const current = daysAgo(50)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Quin', 'quin@example.com') },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser('Quin', 'quin@example.com') }
        },
        time: {
          '1.0.0': prior,
          '2.0.0': current
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(Warning)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(
        /Quin <quin@example.com> had not published this package for 274 days before this release \(more than 6 months dormant\)/
      )
    })

    test('uses last publish by same email, ignoring other maintainers in between', async () => {
      const alice = npmUser('Alice', 'alice-dormant@example.com')
      const bob = npmUser('Bob', 'bob@example.com')
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: alice },
          '2.0.0': { version: '2.0.0', _npmUser: bob },
          '3.0.0': { version: '3.0.0', _npmUser: alice }
        },
        time: {
          '1.0.0': daysAgo(500),
          '2.0.0': daysAgo(400),
          '3.0.0': daysAgo(100)
        }
      }
      const marshall = createMarshall(pakument, '3.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '3.0.0' })
      ).rejects.toThrow(
        /Alice <alice-dormant@example.com> had not published this package for 400 days before this release \(more than 9 months dormant\)/
      )
    })

    test('finds prior publish by timestamp, not versions map key order', async () => {
      const u = npmUser('Ron', 'ron@example.com')
      const pakument = {
        versions: {
          '3.0.0': { version: '3.0.0', _npmUser: u },
          '1.0.0': { version: '1.0.0', _npmUser: u },
          '2.0.0': { version: '2.0.0', _npmUser: u }
        },
        time: {
          '1.0.0': daysAgo(500),
          '2.0.0': daysAgo(300),
          '3.0.0': daysAgo(100)
        }
      }
      const marshall = createMarshall(pakument, '3.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '3.0.0' })
      ).rejects.toThrow(
        /Ron <ron@example.com> had not published this package for 200 days before this release \(more than 6 months dormant\)/
      )
    })
  })

  describe('version recency check', () => {
    test('should error when version is within 7 days (established same-email history)', async () => {
      const oldRelease = daysAgo(100)
      const newRelease = daysAgo(3)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser() },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser() }
        },
        time: {
          '1.0.0': oldRelease,
          '2.0.0': newRelease
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(`This version was published only 3 days ago by Alice <${DEFAULT_EMAIL}>`)
    })

    test('should throw Warning when version is between 8 and 30 days old', async () => {
      const oldRelease = daysAgo(100)
      const newRelease = daysAgo(20)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser() },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser() }
        },
        time: {
          '1.0.0': oldRelease,
          '2.0.0': newRelease
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(Warning)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).rejects.toThrow(`This version was published only 20 days ago by Alice <${DEFAULT_EMAIL}>`)
    })

    test('should pass when version is 31–45 days old (no recency error or warning)', async () => {
      const oldRelease = daysAgo(100)
      const newRelease = daysAgo(40)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser() },
          '2.0.0': { version: '2.0.0', _npmUser: npmUser() }
        },
        time: {
          '1.0.0': oldRelease,
          '2.0.0': newRelease
        }
      }
      const marshall = createMarshall(pakument, '2.0.0')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '2.0.0' })
      ).resolves.toBe(newRelease)
    })

    test('should pass when version is older than 45 days', async () => {
      const published = daysAgo(100)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser() }
        },
        time: {
          '1.0.0': published
        }
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).resolves.toBe(published)
    })

    test('first-only publish at 22 days skips new-author error but still warns on recency', async () => {
      const published = daysAgo(22)
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Eve', 'eve@example.com') }
        },
        time: {
          '1.0.0': published
        }
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).rejects.toThrow(Warning)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).rejects.toThrow(/This version was published only 22 days ago/)
    })
  })

  describe('resolved semver / dist-tags', () => {
    test('should validate using version returned by getSemVer (e.g. latest tag)', async () => {
      const published = daysAgo(200)
      const pakument = {
        'dist-tags': { latest: '1.2.3' },
        versions: {
          '1.2.3': { version: '1.2.3', _npmUser: npmUser() }
        },
        time: {
          '1.2.3': published
        }
      }
      const marshall = createMarshall(pakument, '1.2.3')
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: 'latest' })
      ).resolves.toBe(published)
      expect(marshall.packageRepoUtils.getSemVer).toHaveBeenCalledWith('pkg', 'latest')
    })
  })

  describe('edge cases', () => {
    test('when publish time is in the future, new-author day diff stays 0 and still matches <=21', async () => {
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser('Grace', 'grace@example.com') }
        },
        time: {
          '1.0.0': future
        }
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).rejects.toThrow(
        /Grace <grace@example.com> published this package for the first time only 0 days ago/
      )
    })

    test('when time entry for version is missing, recency math treats age as 0 and throws (current behavior)', async () => {
      const pakument = {
        versions: {
          '1.0.0': { version: '1.0.0', _npmUser: npmUser() }
        },
        time: {}
      }
      const marshall = createMarshall(pakument)
      await expect(
        marshall.validate({ packageName: 'pkg', packageVersion: '1.0.0' })
      ).rejects.toThrow(`This version was published only 0 days ago by Alice <${DEFAULT_EMAIL}>`)
    })
  })
})
