'use strict'

const EventEmitter = require('node:events')
const packageManager = require('../lib/packageManager')
const childProcess = require('child_process')
const originalArgv = process.argv

function createMockChild(exitCode = 0, error) {
  const child = new EventEmitter()
  process.nextTick(() => {
    if (error) {
      child.emit('error', error)
      return
    }

    child.emit('close', exitCode)
  })
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

test.each([
  ['CR', 'npm\rcalc.exe'],
  ['LF', 'npm\ncalc.exe']
])('package manager validation rejects executable strings containing %s', (_lineBreak, value) => {
  expect(() => packageManager.validatePackageManager(value)).toThrow()
})

test.each([
  ['CR', 'package\rcalc.exe'],
  ['LF', 'package\ncalc.exe']
])(
  'process rejects forwarded arguments containing %s before spawning',
  async (_lineBreak, value) => {
    childProcess.spawn.mockImplementation(() => createMockChild(0))
    process.argv = ['node', 'npq', 'install', value]

    await expect(packageManager.process('npm')).rejects.toThrow()
    expect(childProcess.spawn).not.toHaveBeenCalled()
  }
)

test('package manager has a default manager configured', () => {
  expect(packageManager.getDefaultPackageManager()).toBeTruthy()
})

test('package manager spawns successfully when provided valid package manager', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  await packageManager.process('npm')
  expect(childProcess.spawn).toHaveBeenCalledWith('npm', [], {
    stdio: 'inherit',
    shell: false
  })

  childProcess.spawn.mockReset()
})

test('package manager spawns successfully when retrieves default package manager', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  await packageManager.process()
  expect(childProcess.spawn).toHaveBeenCalledWith('npm', [], {
    stdio: 'inherit',
    shell: false
  })

  childProcess.spawn.mockReset()
})

test('package manager spawns successfully when provided array of packages to handle', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'semver', 'express']
  await packageManager.process('npm')
  expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', 'semver', 'express'], {
    stdio: 'inherit',
    shell: false
  })
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
  expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', 'semver', 'express'], {
    stdio: 'inherit',
    shell: false
  })
  childProcess.spawn.mockReset()
})

test('package manager filters the --pkgMgr alias before spawning', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'express', '--pkgMgr']

  await packageManager.process('npm')

  expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', 'express'], {
    stdio: 'inherit',
    shell: false
  })
})

test('package manager strips npq non-interactive install authorization before spawning', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'express', '--allow-non-interactive-install']

  await packageManager.process('npm')

  expect(childProcess.spawn).toHaveBeenCalledWith('npm', ['install', 'express'], {
    stdio: 'inherit',
    shell: false
  })
})

test('package manager spawns with yarn when provided as parameter', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'express']
  await packageManager.process('yarn')
  expect(childProcess.spawn).toHaveBeenCalledWith('yarn', ['install', 'express'], {
    stdio: 'inherit',
    shell: false
  })
  childProcess.spawn.mockReset()
})

test('package manager spawns with pnpm when provided as parameter', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', 'install', 'lodash']
  await packageManager.process('pnpm')
  expect(childProcess.spawn).toHaveBeenCalledWith('pnpm', ['install', 'lodash'], {
    stdio: 'inherit',
    shell: false
  })
  childProcess.spawn.mockReset()
})

test.each([
  ['before add', ['--filter', 'workspace...', 'add', 'express']],
  ['after install', ['install', 'express', '--filter', '...workspace']]
])('pnpm preserves filter and ellipsis selector order %s', async (_placement, args) => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'script name', ...args]

  await packageManager.process('pnpm')

  expect(childProcess.spawn).toHaveBeenCalledWith('pnpm', args, {
    stdio: 'inherit',
    shell: false
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
    'pnpm',
    ['install', '@company/tool', '--registry=https://artifactory.example.test/api/npm/npm/'],
    { stdio: 'inherit', shell: false }
  )
  childProcess.spawn.mockReset()
})

test('passes shell metacharacters as literal arguments without enabling a shell', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'npq', 'install', 'left;touch marker', 'quoted value']

  await packageManager.process('npm')

  expect(childProcess.spawn).toHaveBeenCalledWith(
    'npm',
    ['install', 'left;touch marker', 'quoted value'],
    { stdio: 'inherit', shell: false }
  )
})

test('package manager double-escapes arguments for Windows command shims', async () => {
  const originalPlatform = process.platform
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

  try {
    let windowsPackageManager
    jest.isolateModules(() => {
      windowsPackageManager = require('../lib/packageManager')
    })

    childProcess.spawn.mockImplementation(() => createMockChild(0))
    process.argv = [
      'node',
      'npq',
      'install',
      'safe&value',
      'safe|value',
      '(grouped)',
      '100%literal'
    ]

    await windowsPackageManager.process('package-manager.cmd')

    const [, launchArgs] = childProcess.spawn.mock.calls[0]
    expect(launchArgs[3]).toContain('^^^^^^^&')
    expect(launchArgs[3]).toContain('^^^^^^^|')
    expect(launchArgs[3]).toContain('^^^^^^^(grouped^^^^^^^)')
    expect(launchArgs[3]).toContain('100^%literal')
  } finally {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  }
})

test('uses the package manager executable and literal arguments directly on Windows', () => {
  expect(
    packageManager.getPackageManagerLaunchSpec('npm.cmd', [
      'install',
      'name&whoami',
      'quoted value'
    ])
  ).toEqual({
    executable: 'npm.cmd',
    args: ['install', 'name&whoami', 'quoted value']
  })
})

test('process() rejects when the child process emits an asynchronous error', async () => {
  const spawnError = Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' })
  childProcess.spawn.mockImplementation(() => createMockChild(undefined, spawnError))

  await expect(packageManager.process('npm')).rejects.toBe(spawnError)
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
