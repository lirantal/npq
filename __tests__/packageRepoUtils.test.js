'use strict'

const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')

global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    json: () => require('./mocks/registryPackageOk.mock.json')
  })
)

beforeEach(() => {
  fetch.mockClear()
})

test('repo utils always has a default package registry url', () => {
  const packageRepoUtils = new PackageRepoUtils()
  expect(packageRepoUtils.registryUrl).toBeTruthy()
})

test('repo utils constructor allows setting a package registry url', () => {
  const pkgRegistryUrl = 'https://registry.yarnpkg.com'
  const packageRepoUtils = new PackageRepoUtils({
    registryUrl: pkgRegistryUrl
  })
  expect(packageRepoUtils.registryUrl).toEqual(pkgRegistryUrl)
})

test('repo utils constructor allows setting a package registry api url', () => {
  const pkgRegistryApiUrl = 'https://api.npmjs.org'
  const packageRepoUtils = new PackageRepoUtils({
    registryApiUrl: pkgRegistryApiUrl
  })
  expect(packageRepoUtils.registryApiUrl).toEqual(pkgRegistryApiUrl)
})

test('repo utils returns a package json object from registry', async () => {
  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getPackageInfo(packageName)
  expect(result).toBeTruthy()
})

test('repo utils uses its cache when called with wit the same parameter for the second time', async () => {
  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  await packageRepoUtils.getPackageInfo(packageName)
  await packageRepoUtils.getPackageInfo(packageName)
  expect(fetch.mock.calls.length).toEqual(1)
})

test('repo utils retrieves package latest version', async () => {
  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getLatestVersion(packageName)
  expect(result).toEqual('3.1.0')
})

test('repo utils retrieves package README information', async () => {
  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getReadmeInfo(packageName)
  expect(result).toContain('dockly')
})

test('repo utils retrieves package latest version as null if not exists', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => require('./mocks/registryPackageUnpublished.mock.json')
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getLatestVersion(packageName)
  expect(result).toEqual(null)
})

test('repo utils retrieves package download count', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => ({
        downloads: 1950,
        start: '2017-11-26',
        end: '2017-12-25',
        package: 'express-version-route'
      })
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getDownloadInfo(packageName)
  expect(result).toEqual(1950)
})

test('repo utils retrieves package README information even when not available', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => require('./mocks/registryPackageUnpublished.mock.json')
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getReadmeInfo(packageName)
  expect(result).toBeFalsy()
})

test('repo utils retrieves package LICENSE information', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => require('./mocks/registryPackageOk.mock.json')
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getLicenseInfo(packageName)
  expect(result).toBeTruthy()
})

test('repo utils parses package version', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => require('./mocks/registryPackageOk.mock.json')
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.parsePackageVersion(
    await packageRepoUtils.getLatestVersion(packageName)
  )
  expect(result).toBeTruthy()
})

test('repo utils returns valid semver for different cases of version asked', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => require('./mocks/registryPackageOk.mock.json')
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'

  let result

  result = await packageRepoUtils.getSemVer(packageName, 'latest')
  expect(result).toEqual('3.1.0')

  result = await packageRepoUtils.getSemVer(packageName, '3.1.0')
  expect(result).toEqual('3.1.0')

  await expect(packageRepoUtils.getSemVer(packageName, 'next')).rejects.toThrow(
    'Could not find dist-tag next for package testPackage'
  )
})

test('repo utils resolves semver ranges by finding the highest satisfying version', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => require('./mocks/registryPackageOk.mock.json')
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'

  // Test major version range - should find highest 3.x version (3.1.0)
  let result = await packageRepoUtils.getSemVer(packageName, '^3.0.0')
  expect(result).toEqual('3.1.0')

  // Test simple major version - should find highest 3.x version (3.1.0)
  result = await packageRepoUtils.getSemVer(packageName, '3')
  expect(result).toEqual('3.1.0')

  // Test tilde range - should find 3.1.x version (3.1.0)
  result = await packageRepoUtils.getSemVer(packageName, '~3.1.0')
  expect(result).toEqual('3.1.0')

  // Test invalid semver range that doesn't match any version
  await expect(packageRepoUtils.getSemVer(packageName, '^10.0.0')).rejects.toThrow(
    'Could not find dist-tag ^10.0.0 for package testPackage'
  )

  // Test invalid semver range with version 2 (no 2.x versions in mock)
  await expect(packageRepoUtils.getSemVer(packageName, '2')).rejects.toThrow(
    'Could not find dist-tag 2 for package testPackage'
  )
})

test('repo utils resolves semver ranges with multiple versions', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')

  // Create a more comprehensive mock that includes multiple versions
  const comprehensiveMock = {
    name: '@astrojs/vue',
    'dist-tags': {
      latest: '4.5.0'
    },
    versions: {
      '1.2.0': { name: '@astrojs/vue', version: '1.2.0' },
      '2.0.0': { name: '@astrojs/vue', version: '2.0.0' },
      '2.1.0': { name: '@astrojs/vue', version: '2.1.0' },
      '2.2.1': { name: '@astrojs/vue', version: '2.2.1' },
      '3.0.0': { name: '@astrojs/vue', version: '3.0.0' },
      '3.1.0': { name: '@astrojs/vue', version: '3.1.0' },
      '3.2.2': { name: '@astrojs/vue', version: '3.2.2' },
      '4.0.0': { name: '@astrojs/vue', version: '4.0.0' },
      '4.5.0': { name: '@astrojs/vue', version: '4.5.0' }
    }
  }

  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      json: () => comprehensiveMock
    })
  )

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = '@astrojs/vue'

  // Test the problematic case mentioned in the issue: "@astrojs/vue@3"
  let result = await packageRepoUtils.getSemVer(packageName, '3')
  expect(result).toEqual('3.2.2') // Should find highest 3.x version

  // Test other major versions
  result = await packageRepoUtils.getSemVer(packageName, '2')
  expect(result).toEqual('2.2.1') // Should find highest 2.x version

  result = await packageRepoUtils.getSemVer(packageName, '4')
  expect(result).toEqual('4.5.0') // Should find highest 4.x version

  // Test caret ranges
  result = await packageRepoUtils.getSemVer(packageName, '^3.0.0')
  expect(result).toEqual('3.2.2')

  result = await packageRepoUtils.getSemVer(packageName, '^2.1.0')
  expect(result).toEqual('2.2.1')

  // Test that non-existent major versions still fail appropriately
  await expect(packageRepoUtils.getSemVer(packageName, '10')).rejects.toThrow(
    'Could not find dist-tag 10 for package @astrojs/vue'
  )
})

describe('extractGitHubRepoFromUrl', () => {
  const packageRepoUtils = new PackageRepoUtils()

  test('extracts owner and repo from git+https URL', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl(
      'git+https://github.com/lirantal/npq.git'
    )
    expect(result).toEqual({ owner: 'lirantal', repo: 'npq' })
  })

  test('extracts owner and repo from https URL with .git', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl('https://github.com/owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  test('extracts owner and repo from https URL without .git', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl('https://github.com/owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  test('extracts owner and repo from git:// URL', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl('git://github.com/owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  test('extracts owner and repo from git@ SSH URL', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl('git@github.com:owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  test('handles owner/repo names with dots and hyphens', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl(
      'git+https://github.com/some-org/my-package.js.git'
    )
    expect(result).toEqual({ owner: 'some-org', repo: 'my-package.js' })
  })

  test('returns null for GitLab URLs', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl(
      'git+https://gitlab.com/owner/repo.git'
    )
    expect(result).toBeNull()
  })

  test('returns null for Bitbucket URLs', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl(
      'git+https://bitbucket.org/owner/repo.git'
    )
    expect(result).toBeNull()
  })

  test('returns null for null input', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl(null)
    expect(result).toBeNull()
  })

  test('returns null for undefined input', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl(undefined)
    expect(result).toBeNull()
  })

  test('returns null for empty string', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl('')
    expect(result).toBeNull()
  })

  test('returns null for non-string input', () => {
    const result = packageRepoUtils.extractGitHubRepoFromUrl({ url: 'github.com/owner/repo' })
    expect(result).toBeNull()
  })
})

describe('isGitHubRepoArchived', () => {
  const packageRepoUtils = new PackageRepoUtils()
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.GITHUB_TOKEN
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns true when repository is archived', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ archived: true })
      })
    )

    const result = await packageRepoUtils.isGitHubRepoArchived('owner', 'repo')
    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/owner/repo', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'npq-package-checker'
      }
    })
  })

  test('returns false when repository is not archived', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ archived: false })
      })
    )

    const result = await packageRepoUtils.isGitHubRepoArchived('owner', 'repo')
    expect(result).toBe(false)
  })

  test('returns false when repository is not found (404)', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 404
      })
    )

    const result = await packageRepoUtils.isGitHubRepoArchived('owner', 'nonexistent')
    expect(result).toBe(false)
  })

  test('throws error on rate limit (403 with x-ratelimit-remaining: 0)', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        headers: {
          get: (name) => (name === 'x-ratelimit-remaining' ? '0' : null)
        }
      })
    )

    await expect(packageRepoUtils.isGitHubRepoArchived('owner', 'repo')).rejects.toThrow(
      'GitHub API rate limit exceeded - deprecation marshall could not evaluate repository archive status. Set GITHUB_TOKEN environment variable for higher rate limits.'
    )
  })

  test('throws error on 403 without rate limit', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        headers: {
          get: () => null
        }
      })
    )

    await expect(packageRepoUtils.isGitHubRepoArchived('owner', 'repo')).rejects.toThrow(
      'GitHub API access forbidden for owner/repo - deprecation marshall could not evaluate repository archive status'
    )
  })

  test('throws error on other API errors', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500
      })
    )

    await expect(packageRepoUtils.isGitHubRepoArchived('owner', 'repo')).rejects.toThrow(
      'GitHub API error (500) - deprecation marshall could not evaluate repository archive status'
    )
  })

  test('uses GITHUB_TOKEN when available', async () => {
    process.env.GITHUB_TOKEN = 'test-token'

    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ archived: false })
      })
    )

    await packageRepoUtils.isGitHubRepoArchived('owner', 'repo')
    expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/owner/repo', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'npq-package-checker',
        Authorization: 'token test-token'
      }
    })
  })
})
