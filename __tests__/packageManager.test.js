'use strict'

const EventEmitter = require('node:events')
const packageManager = require('../lib/packageManager')
const childProcess = require('child_process')
const originalArgv = process.argv

function createMockChild(exitCode = 0) {
  const child = new EventEmitter()
  process.nextTick(() => child.emit('close', exitCode))
  return child
}

jest.mock('child_process', () => {
  return {
    spawn: jest.fn(() => {
      return new (require('node:events').EventEmitter)()
    })
  }
})

beforeEach(() => {
  childProcess.spawn.mockReset()
  process.argv = ['node', 'npq']
})

afterAll(() => {
  process.argv = originalArgv
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
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  await packageManager.process('npm')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')

  childProcess.spawn.mockReset()
})

test('package manager spawns successfully when retrieves default package manager', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  await packageManager.process()
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toBe('npm')

  childProcess.spawn.mockReset()
})

test('package manager spawns successfully when provided array of packages to handle', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'semver', 'express']
  await packageManager.process('npm')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toEqual('npm install semver express')
  childProcess.spawn.mockReset()
})

test("package manager spawns successfully and ignore npq's own internal commands when spawning package manager", async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
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
  expect(childProcess.spawn.mock.calls[0][0]).toEqual('npm install semver express')
  childProcess.spawn.mockReset()
})

test('package manager spawns with yarn when provided as parameter', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'express']
  await packageManager.process('yarn')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toEqual('yarn install express')
  childProcess.spawn.mockReset()
})

test('package manager spawns with pnpm when provided as parameter', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'lodash']
  await packageManager.process('pnpm')
  expect(childProcess.spawn).toHaveBeenCalled()
  expect(childProcess.spawn.mock.calls.length).toBe(1)
  expect(childProcess.spawn.mock.calls[0][0]).toEqual('pnpm install lodash')
  childProcess.spawn.mockReset()
})

test.each([
  ['before add', ['--filter', 'workspace...', 'add', 'express']],
  ['after install', ['install', 'express', '--filter', '...workspace']]
])('pnpm preserves filter and ellipsis selector order %s', async (_placement, args) => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', ...args]

  await packageManager.process('pnpm')

  expect(childProcess.spawn).toHaveBeenCalledWith(`pnpm ${args.join(' ')}`, {
    stdio: 'inherit',
    shell: true
  })
})

test('package manager forwards custom registry options', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = [
    'node',
    'npq',
    'install',
    '@company/tool',
    '--registry=https://artifactory.example.test/api/npm/npm/'
  ]

  await packageManager.process('pnpm')

  expect(childProcess.spawn).toHaveBeenCalledWith(
    'pnpm install @company/tool --registry=https://artifactory.example.test/api/npm/npm/',
    expect.objectContaining({ stdio: 'inherit', shell: true })
  )
  childProcess.spawn.mockReset()
})

describe('exit code propagation', () => {
  test('process() resolves with exit code 0 when child exits successfully', async () => {
    childProcess.spawn.mockImplementation(() => createMockChild(0))
    const exitCode = await packageManager.process('npm')
    expect(exitCode).toBe(0)
    childProcess.spawn.mockReset()
  })

  test('process() resolves with exit code 1 when child exits with failure', async () => {
    childProcess.spawn.mockImplementation(() => createMockChild(1))
    const exitCode = await packageManager.process('npm')
    expect(exitCode).toBe(1)
    childProcess.spawn.mockReset()
  })

  test('process() resolves with exit code 2 when child exits with code 2', async () => {
    childProcess.spawn.mockImplementation(() => createMockChild(2))
    const exitCode = await packageManager.process('npm')
    expect(exitCode).toBe(2)
    childProcess.spawn.mockReset()
  })

  test('process() propagates non-zero exit code from yarn', async () => {
    childProcess.spawn.mockImplementation(() => createMockChild(1))
    process.argv = ['node', 'script name', 'audit']
    const exitCode = await packageManager.process('yarn')
    expect(exitCode).toBe(1)
    childProcess.spawn.mockReset()
  })
})
