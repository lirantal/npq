const packageManager = require('../lib/packageManager')
const childProcess = require('child_process')

jest.mock('child_process', () => {
  return {
    spawn: jest.fn((cmd, args, options) => {
      return true
    })
  }
})

test('package manager validation should fail if provided array', () => {
  expect(() => packageManager.validatePackageManager(['something'])).toThrow()
})

test('package manager validation should fail if provided function', () => {
  expect(() => packageManager.validatePackageManager(() => {})).toThrow()
})
test('package manager validation should fail if provided boolean', () => {
  expect(() => packageManager.validatePackageManager(true)).toThrow()
})

test('package manager validation should fail if provided object', () => {
  expect(() => packageManager.validatePackageManager({ a: 'b' })).toThrow()
})

test('package manager has a default manager configured', () => {
  expect(packageManager.getDefaultPackageManager()).toBeTruthy()
})

test('package manager spawns successfully when provided valid package manager', async () => {
  await packageManager.process('npm')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')

  childProcess.spawn.mockReset()
})

test('package manager spawns successfully when retrieves default package manager', async () => {
  await packageManager.process()
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')

  childProcess.spawn.mockReset()
})

test('package manager spawns successfully when provided array of packages to handle', async () => {
  await packageManager.process('npm', ['semver', 'express'])
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')

  expect(childProcess.spawn.mock.calls[0][1]).toEqual([
    'install',
    'semver',
    'express'
  ])
  childProcess.spawn.mockReset()
})
