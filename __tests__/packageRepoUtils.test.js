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
