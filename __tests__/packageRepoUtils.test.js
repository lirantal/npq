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
    'could not find dist-tag next for package testPackage'
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
    'could not find dist-tag ^10.0.0 for package testPackage'
  )

  // Test invalid semver range with version 2 (no 2.x versions in mock)
  await expect(packageRepoUtils.getSemVer(packageName, '2')).rejects.toThrow(
    'could not find dist-tag 2 for package testPackage'
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
    'could not find dist-tag 10 for package @astrojs/vue'
  )
})
