'use strict'

const Marshall = require('../lib/marshall')

test('accepts null options as an empty audit', async () => {
  const marshall = new Marshall(null)

  await expect(marshall.process()).resolves.toBeUndefined()
})

test('inherits the registry client from an injected package repository helper', () => {
  const registryClient = { registryFor: jest.fn() }
  const packageRepoUtils = { registryClient }

  const marshall = new Marshall({
    pkgs: ['@company/tool'],
    packageRepoUtils
  })

  expect(marshall.registryClient).toBe(registryClient)
  expect(marshall.packageRepoUtils).toBe(packageRepoUtils)
})
