'use strict'

const {
  MAX_VERSION_RECENCY_DAYS,
  findAlternativeVersion,
  getRoundedVersionAgeDays
} = require('../lib/helpers/versionAge')

const NOW = Date.parse('2026-05-18T20:15:09.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function publishedDaysAgo(days) {
  return new Date(NOW - days * DAY_MS).toISOString()
}

function packageInfo(entries) {
  return entries.reduce(
    (result, [version, ageDays, publishedAt]) => {
      result.versions[version] = { version }
      result.time[version] = publishedAt || publishedDaysAgo(ageDays)
      return result
    },
    { versions: {}, time: {} }
  )
}

describe('version age policy', () => {
  test('uses the author marshall maximum recency window', () => {
    expect(MAX_VERSION_RECENCY_DAYS).toBe(30)
  })

  test('calculates rounded whole-day age deterministically', () => {
    expect(getRoundedVersionAgeDays(publishedDaysAgo(30), NOW)).toBe(30)
    expect(getRoundedVersionAgeDays(publishedDaysAgo(31), NOW)).toBe(31)
    expect(getRoundedVersionAgeDays(new Date(NOW + DAY_MS).toISOString(), NOW)).toBe(0)
    expect(getRoundedVersionAgeDays('not-a-date', NOW)).toBeNull()
  })
})

describe('findAlternativeVersion', () => {
  test('selects the newest stable release outside the 30-day window for issue 424', () => {
    const info = packageInfo([
      ['0.131.0', 0],
      ['0.131.0-win32-x64', 40],
      ['0.130.0', 10],
      ['0.121.0', 33],
      ['0.120.0', 37]
    ])

    expect(
      findAlternativeVersion({
        packageInfo: info,
        targetVersion: '0.131.0',
        requestedVersion: 'latest',
        now: NOW
      })
    ).toEqual({
      version: '0.121.0',
      publishedAt: publishedDaysAgo(33),
      ageDays: 33
    })
  })

  test('requires rounded age to be strictly greater than 30 days', () => {
    const atBoundary = packageInfo([
      ['2.0.0', 0],
      ['1.0.0', 30]
    ])
    const outsideBoundary = packageInfo([
      ['2.0.0', 0],
      ['1.0.0', 31]
    ])

    expect(
      findAlternativeVersion({
        packageInfo: atBoundary,
        targetVersion: '2.0.0',
        requestedVersion: 'latest',
        now: NOW
      })
    ).toBeNull()
    expect(
      findAlternativeVersion({
        packageInfo: outsideBoundary,
        targetVersion: '2.0.0',
        requestedVersion: 'latest',
        now: NOW
      })
    ).toMatchObject({ version: '1.0.0', ageDays: 31 })
  })

  test('allows latest and exact requests to cross a major version boundary', () => {
    const info = packageInfo([
      ['2.0.0', 0],
      ['1.9.9', 40]
    ])

    for (const requestedVersion of ['latest', '2.0.0']) {
      expect(
        findAlternativeVersion({
          packageInfo: info,
          targetVersion: '2.0.0',
          requestedVersion,
          now: NOW
        })
      ).toMatchObject({ version: '1.9.9' })
    }
  })

  test('keeps non-exact semver ranges inside the requested range', () => {
    const info = packageInfo([
      ['2.2.0', 0],
      ['2.1.0', 10],
      ['2.0.0', 40],
      ['1.9.9', 35]
    ])

    expect(
      findAlternativeVersion({
        packageInfo: info,
        targetVersion: '2.2.0',
        requestedVersion: '^2.0.0',
        now: NOW
      })
    ).toMatchObject({ version: '2.0.0' })
  })

  test('excludes prerelease candidates for stable targets', () => {
    const info = packageInfo([
      ['2.0.0', 0],
      ['1.9.9-win32-x64', 40],
      ['1.9.8', 45]
    ])

    expect(
      findAlternativeVersion({
        packageInfo: info,
        targetVersion: '2.0.0',
        requestedVersion: 'latest',
        now: NOW
      })
    ).toMatchObject({ version: '1.9.8' })
  })

  test('allows prerelease predecessors for prerelease targets', () => {
    const info = packageInfo([
      ['2.0.0-beta.2', 0],
      ['2.0.0-beta.1', 40],
      ['1.9.9', 45]
    ])

    expect(
      findAlternativeVersion({
        packageInfo: info,
        targetVersion: '2.0.0-beta.2',
        requestedVersion: 'beta',
        now: NOW
      })
    ).toMatchObject({ version: '2.0.0-beta.1' })
  })

  test('selects the highest eligible semver instead of the most recently published release', () => {
    const info = packageInfo([
      ['4.0.0', 0],
      ['3.0.0', 100],
      ['2.0.0', 31]
    ])

    expect(
      findAlternativeVersion({
        packageInfo: info,
        targetVersion: '4.0.0',
        requestedVersion: 'latest',
        now: NOW
      })
    ).toMatchObject({ version: '3.0.0', ageDays: 100 })
  })

  test('skips invalid versions and timestamps and versions newer than the target', () => {
    const info = packageInfo([
      ['2.0.0', 0],
      ['3.0.0', 90],
      ['invalid', 90],
      ['1.5.0', 90, 'not-a-date'],
      ['1.0.0', 45]
    ])

    expect(
      findAlternativeVersion({
        packageInfo: info,
        targetVersion: '2.0.0',
        requestedVersion: 'latest',
        now: NOW
      })
    ).toMatchObject({ version: '1.0.0' })
  })

  test('returns null when required metadata is absent or no candidate is eligible', () => {
    const recentOnly = packageInfo([
      ['2.0.0', 0],
      ['1.0.0', 20]
    ])

    const scenarios = [
      { packageInfo: null, targetVersion: '2.0.0' },
      { packageInfo: {}, targetVersion: '2.0.0' },
      { packageInfo: recentOnly, targetVersion: 'not-semver' },
      { packageInfo: recentOnly, targetVersion: '2.0.0' }
    ]

    for (const scenario of scenarios) {
      expect(
        findAlternativeVersion({
          ...scenario,
          requestedVersion: 'latest',
          now: NOW
        })
      ).toBeNull()
    }
  })
})
