const path = require('path')
const marshalls = require('../lib/marshalls')

const PackageRepoUtilsMock = class Fake {
  getPackageInfo() {
    return Promise.resolve(true)
  }
}

test('running marshall tasks succeeds', async () => {
  marshalls.collectMarshalls = jest.fn(() => {
    return Promise.resolve([path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')])
  })

  const config = {
    pkgs: [{ packageName: 'express' }, { packageName: 'semver' }],
    packageRepoUtils: new PackageRepoUtilsMock()
  }

  const results = await marshalls.tasks(config)

  expect(results[0]['test.marshall']).toEqual({
    status: null,
    errors: [],
    warnings: [],
    data: { express: 'mock data check', semver: 'mock data check' },
    marshall: 'test.marshall',
    categoryId: 'PackageHealth'
  })
})

test('running marshall tasks fails', async () => {
  marshalls.collectMarshalls = jest.fn(() => {
    return Promise.resolve([path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')])
  })

  const config = {
    pkgs: [{ packageName: 'express' }, { packageName: 'dockly' }],
    packageRepoUtils: new PackageRepoUtilsMock()
  }

  const mockedResults = [
    {
      'test.marshall': {
        status: null,
        errors: [{ pkg: 'dockly', message: 'simulating mock error' }],
        warnings: [],
        data: { express: 'mock data check' }
      }
    }
  ]

  await expect(marshalls.tasks(config)).resolves.toMatchObject(mockedResults)
})

test('running marshall tasks includes an error when single package is not found', async () => {
  const PackageRepoUtilsNotFoundMock = class Fake {
    getPackageInfo() {
      return Promise.resolve({ error: 'Not found' })
    }
  }

  marshalls.collectMarshalls = jest.fn(() => {
    return Promise.resolve([path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')])
  })

  const config = {
    pkgs: [{ packageName: 'nonexistent-package' }],
    packageRepoUtils: new PackageRepoUtilsNotFoundMock()
  }

  const mockedResults = [
    {
      not_found: {
        status: null,
        errors: [{ pkg: 'nonexistent-package', message: 'Package not found' }],
        warnings: [],
        data: {},
        marshall: 'not_found',
        categoryId: 'PackageHealth'
      }
    }
  ]

  await expect(marshalls.tasks(config)).resolves.toMatchObject(mockedResults)
})

test('running marshall tasks filters out not found packages when multiple packages provided', async () => {
  const PackageRepoUtilsMixedMock = class Fake {
    getPackageInfo(packageName) {
      if (packageName === 'nonexistent-package') {
        return Promise.resolve({ error: 'Not found' })
      }
      return Promise.resolve(true)
    }
  }

  marshalls.collectMarshalls = jest.fn(() => {
    return Promise.resolve([path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')])
  })

  const config = {
    pkgs: [
      { packageName: 'express' },
      { packageName: 'nonexistent-package' },
      { packageName: 'semver' }
    ],
    packageRepoUtils: new PackageRepoUtilsMixedMock()
  }

  const result = await marshalls.tasks(config)

  expect(result[0]['not_found']).toEqual({
    status: null,
    errors: [{ pkg: 'nonexistent-package', message: 'Package not found' }],
    warnings: [],
    data: {},
    marshall: 'not_found',
    categoryId: 'PackageHealth'
  })

  expect(result[1]['test.marshall']).toEqual({
    status: null,
    errors: [],
    warnings: [],
    data: { express: 'mock data check', semver: 'mock data check' },
    marshall: 'test.marshall',
    categoryId: 'PackageHealth'
  })
})
