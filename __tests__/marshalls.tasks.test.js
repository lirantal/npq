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
    pkgs: ['express', 'semver'],
    packageRepoUtils: new PackageRepoUtilsMock()
  }

  const tasks = await marshalls.tasks(config)
  expect(tasks.pkgs).toEqual(['express', 'semver'])
  expect(tasks.marshalls).toEqual({
    'test.marshall': {
      status: null,
      errors: [],
      warnings: [],
      data: { express: 'mock data check', semver: 'mock data check' }
    }
  })
})

test('running marshall tasks fails', async () => {
  marshalls.collectMarshalls = jest.fn(() => {
    return Promise.resolve([path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')])
  })

  const config = {
    pkgs: ['express', 'dockly'],
    packageRepoUtils: new PackageRepoUtilsMock()
  }

  const context = {
    pkgs: ['express', 'dockly'],
    marshalls: {
      'test.marshall': {
        status: null,
        errors: [{ pkg: 'dockly', message: 'simulating mock error' }],
        warnings: [],
        data: { express: 'mock data check' }
      }
    }
  }

  await expect(marshalls.tasks(config)).resolves.toMatchObject(context)
})

test('running marshall tasks throws error when single package is not found', async () => {
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

  await expect(marshalls.tasks(config)).resolves.toEqual({
    error: true,
    message: 'Package not found: nonexistent-package'
  })
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
  // Should filter out the nonexistent package and keep only express and semver
  expect(result.pkgs).toHaveLength(2)
  expect(result.pkgs).toEqual([{ packageName: 'express' }, { packageName: 'semver' }])
})
