const packageManager = require('../lib/packageManager')

const childProcess = require('child_process')

jest.mock('child_process', () => {
  return {
    // eslint-disable-next-line no-unused-vars
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
  process.argv = ['node', 'script name', 'install', 'semver', 'express']
  await packageManager.process('npm')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')

  expect(childProcess.spawn.mock.calls[0][1]).toEqual(['install', 'semver', 'express'])
  childProcess.spawn.mockReset()
})

test("package manager spawns successfully and ignore npq's own internal commands when spawning package manager", async () => {
  process.argv = [
    'node',
    'script name',
    'install',
    'semver',
    'express',
    '--dry-run',
    '--packageManager'
  ]
  await packageManager.process('npm')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')

  expect(childProcess.spawn.mock.calls[0][1]).toEqual(['install', 'semver', 'express'])
  childProcess.spawn.mockReset()
})

test('package manager spawns with yarn when provided as parameter', async () => {
  process.argv = ['node', 'script name', 'install', 'express']
  await packageManager.process('yarn')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('yarn')

  expect(childProcess.spawn.mock.calls[0][1]).toEqual(['install', 'express'])
  childProcess.spawn.mockReset()
})

test('package manager spawns with pnpm when provided as parameter', async () => {
  process.argv = ['node', 'script name', 'install', 'lodash']
  await packageManager.process('pnpm')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('pnpm')

  expect(childProcess.spawn.mock.calls[0][1]).toEqual(['install', 'lodash'])
  childProcess.spawn.mockReset()
})
