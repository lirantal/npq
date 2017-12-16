const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
jest.mock('axios', () => {
  return {
    get: jest.fn(() => {
      return Promise.resolve({
        data: require('./registryPackage.mock.json')
      })
    })
  }
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
