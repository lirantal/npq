'use strict'

beforeEach(() => {
  jest.resetModules()
})

test('collecting marshalls resolves with files array', async () => {
  const marshalls = require('../lib/marshalls')

  const marshallFiles = await marshalls.collectMarshalls()
  expect(marshallFiles.length).toBeGreaterThan(0)
  expect(marshallFiles.every((file) => file.endsWith('.marshall.js'))).toBe(true)
})

test('collecting marshalls handles directory read errors', async () => {
  const fs = require('node:fs')
  const marshalls = require('../lib/marshalls')

  // Mock fs.promises.readdir to throw an error
  const originalReaddir = fs.promises.readdir
  fs.promises.readdir = jest.fn().mockRejectedValue(new Error('Directory read error'))

  await expect(marshalls.collectMarshalls()).rejects.toThrow('Directory read error')

  // Restore original function
  fs.promises.readdir = originalReaddir
})

test('build marshalls without any should throw error', () => {
  const marshalls = require('../lib/marshalls')

  expect(marshalls.buildMarshallTasks([])).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks({})).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks(5)).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks('something')).rejects.toEqual(expect.any(Error))
})

test('build marshall tasks exposes each marshall name', async () => {
  const path = require('path')
  const marshalls = require('../lib/marshalls')
  const tasks = await marshalls.buildMarshallTasks(
    [path.join(process.cwd(), '__tests__/__fixtures__/test.marshall.js')],
    { packageRepoUtils: {} }
  )

  expect(tasks).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'test.marshall' })])
  )
})

test('Marshall passes the audit failure callback to marshall tasks', async () => {
  const Marshall = require('../lib/marshall')
  const marshalls = require('../lib/marshalls')
  const onAuditFailure = jest.fn()
  const tasks = jest.spyOn(marshalls, 'tasks').mockResolvedValue([])
  const packageRepoUtils = {}
  const marshall = new Marshall({ onAuditFailure })

  await marshall.createPackageAuditFunction('express@latest', packageRepoUtils)

  expect(tasks).toHaveBeenCalledWith(
    {
      pkgs: [
        {
          packageName: 'express',
          packageVersion: 'latest',
          packageString: 'express@latest'
        }
      ],
      packageRepoUtils
    },
    null,
    { onAuditFailure }
  )

  tasks.mockRestore()
})
