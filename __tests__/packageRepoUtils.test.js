const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
jest.mock('axios', () => {
  return {
    get: jest.fn(() => {
      return Promise.resolve({
        data: require('./mocks/registryPackageOk.mock.json')
      })
    })
  }
})

beforeEach(() => {
  jest.resetModules()
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

test('repo utils retrieves package latest version', async () => {
  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getLatestVersion(packageName)
  expect(result).toEqual('3.1.0')
})

test('repo utils retrieves package latest version as null if not exists', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  jest.mock('axios', () => {
    return {
      get: jest.fn(() => {
        return Promise.resolve({
          data: require('./mocks/registryPackageUnpublished.mock.json')
        })
      })
    }
  })

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getLatestVersion(packageName)
  expect(result).toEqual(null)
})

test('repo utils retrieves package README information', async () => {
  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getReadmeInfo(packageName)
  expect(result).toContain('dockly')
})

test('repo utils retrieves package download count', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  jest.mock('axios', () => {
    return {
      get: jest.fn(() => {
        return Promise.resolve({
          data: {
            downloads: 1950,
            start: '2017-11-26',
            end: '2017-12-25',
            package: 'express-version-route'
          }
        })
      })
    }
  })

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getDownloadInfo(packageName)
  expect(result).toEqual(1950)
})

test('repo utils retrieves package README information even when not available', async () => {
  const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
  jest.mock('axios', () => {
    return {
      get: jest.fn(() => {
        return Promise.resolve({
          data: require('./mocks/registryPackageUnpublished.mock.json')
        })
      })
    }
  })

  const packageRepoUtils = new PackageRepoUtils()
  const packageName = 'testPackage'
  const result = await packageRepoUtils.getReadmeInfo(packageName)
  expect(result).toBeFalsy()
})
