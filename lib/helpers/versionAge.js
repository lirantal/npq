'use strict'

const semver = require('semver')

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_VERSION_RECENCY_DAYS = 30

function getRoundedVersionAgeDays(publishedAt, now = Date.now()) {
  const publishedAtMs = Date.parse(publishedAt)
  const nowMs = now instanceof Date ? now.getTime() : Number(now)

  if (Number.isNaN(publishedAtMs) || Number.isNaN(nowMs)) {
    return null
  }

  const ageMs = nowMs - publishedAtMs
  return ageMs > 0 ? Math.round(ageMs / DAY_MS) : 0
}

function findAlternativeVersion({
  packageInfo,
  targetVersion,
  requestedVersion,
  now = Date.now()
}) {
  if (
    !packageInfo ||
    !packageInfo.versions ||
    !packageInfo.time ||
    !semver.valid(targetVersion)
  ) {
    return null
  }

  const targetIsStable = semver.prerelease(targetVersion) === null
  const requestedRange =
    typeof requestedVersion === 'string' && !semver.valid(requestedVersion)
      ? semver.validRange(requestedVersion)
      : null

  const candidates = Object.keys(packageInfo.versions)
    .filter((version) => semver.valid(version) && semver.lt(version, targetVersion))
    .filter((version) => !targetIsStable || semver.prerelease(version) === null)
    .filter((version) => !requestedRange || semver.satisfies(version, requestedRange))
    .map((version) => {
      const publishedAt = packageInfo.time[version]
      const ageDays = getRoundedVersionAgeDays(publishedAt, now)
      return { version, publishedAt, ageDays }
    })
    .filter(
      ({ publishedAt, ageDays }) =>
        typeof publishedAt === 'string' &&
        ageDays !== null &&
        ageDays > MAX_VERSION_RECENCY_DAYS
    )
    .sort((left, right) => semver.rcompare(left.version, right.version))

  return candidates[0] || null
}

module.exports = {
  MAX_VERSION_RECENCY_DAYS,
  findAlternativeVersion,
  getRoundedVersionAgeDays
}
