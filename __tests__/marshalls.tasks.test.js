const path = require('path')
const marshalls = require('../lib/marshalls')

const PackageRepoUtilsMock = class Fake {
  getPackageInfo () { return Promise.resolve(true) }
}

test('running marshall tasks succeeds', async () => {
  marshalls.collectMarshalls = jest.fn(() => {
    return Promise.resolve([
      path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')
    ])
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
    return Promise.resolve([
      path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')
    ])
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

  await expect(marshalls.tasks(config)).rejects.toMatchObject({
    message: 'Something went wrong',
    context: context
  })
})
