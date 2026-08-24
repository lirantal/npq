'use strict'

jest.mock('../lib/helpers/cliSupportHandler', () => ({
  isEnvSupport: jest.fn().mockReturnValue(true),
  isInteractiveTerminal: jest.fn().mockReturnValue(false),
  noSupportError: jest.fn()
}))

jest.mock('../lib/helpers/cliSpinner', () => ({
  Spinner: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn()
  }))
}))

jest.mock('../lib/marshall', () =>
  jest.fn(() => ({
    process: jest.fn().mockResolvedValue({})
  }))
)

jest.mock('../lib/helpers/reportResults', () => ({
  reportResults: jest.fn().mockReturnValue({ countErrors: 0, countWarnings: 0 })
}))

jest.mock('../lib/helpers/cliPrompt.js', () => ({
  prompt: jest.fn().mockResolvedValue({ install: true }),
  autoContinue: jest.fn().mockResolvedValue({ install: true })
}))

jest.mock('../lib/helpers/sourcePackages', () => ({
  getProjectPackages: jest.fn().mockResolvedValue(['express'])
}))

jest.mock('../lib/jsonCli', () => ({
  runJsonCli: jest.fn().mockResolvedValue({ status: 'clean' }),
  writeInvalidJsonInvocation: jest.fn()
}))
jest.mock('../lib/helpers/registryConfig', () => ({
  load: jest.fn().mockResolvedValue({ requestOptions: {} })
}))

jest.mock('../lib/helpers/registryClient', () =>
  jest.fn().mockImplementation(() => ({ registryFor: jest.fn() }))
)

jest.mock('../lib/helpers/promiseThrottler', () => ({
  promiseThrottleHelper: jest.fn()
}))

const originalProcessExit = process.exit
const originalExitCode = process.exitCode
const originalSigintListeners = process.listeners('SIGINT')

let mockProcessExit
let existingSigintListeners

let mockPkgMgrProcessResolvedValue = 0
jest.mock('../lib/packageManager', () => ({
  process: jest.fn(() => Promise.resolve(mockPkgMgrProcessResolvedValue))
}))

const mockNpqCliArgs = {
  packages: ['express'],
  packageManager: 'npm',
  dryRun: false,
  plain: false,
  json: false,
  disableAutoContinue: false,
  installSubcommandExplicit: true,
  allowNonInteractiveInstall: false
}

jest.mock('../lib/cli', () => ({
  CliParser: {
    parseArgsFull: jest.fn(),
    parseArgsMinimal: jest.fn().mockReturnValue({
      packages: []
    }),
    exit: jest.fn()
  }
}))

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve))
}

function setupProcessState() {
  existingSigintListeners = new Set(process.listeners('SIGINT'))
  mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {})
}

function restoreProcessState() {
  process.exitCode = originalExitCode
  mockProcessExit.mockRestore()
  for (const listener of process.listeners('SIGINT')) {
    if (!existingSigintListeners.has(listener)) {
      process.removeListener('SIGINT', listener)
    }
  }
}

describe('npq-hero exit code propagation', () => {
  beforeEach(() => {
    setupProcessState()
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode
    mockPkgMgrProcessResolvedValue = 0

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsMinimal.mockReturnValue({ packages: [] })
  })

  afterEach(() => {
    restoreProcessState()
  })

  test('sets process.exitCode to 1 when package manager exits with code 1', async () => {
    mockPkgMgrProcessResolvedValue = 1
    require('../bin/npq-hero.js')
    await flushPromises()

    expect(process.exitCode).toBe(1)
  })

  test('sets process.exitCode to 0 when package manager exits with code 0', async () => {
    mockPkgMgrProcessResolvedValue = 0
    require('../bin/npq-hero.js')
    await flushPromises()

    expect(process.exitCode).toBe(0)
  })

  test('propagates non-zero exit code for non-install commands (silent mode)', async () => {
    mockPkgMgrProcessResolvedValue = 1

    require('../bin/npq-hero.js')
    await flushPromises()

    expect(process.exitCode).toBe(1)
  })
})

describe('npq exit code propagation', () => {
  beforeEach(() => {
    setupProcessState()
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode
    mockPkgMgrProcessResolvedValue = 0
    mockNpqCliArgs.installSubcommandExplicit = true
    mockNpqCliArgs.dryRun = false
    mockNpqCliArgs.json = false

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({ ...mockNpqCliArgs }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({ countErrors: 0, countWarnings: 0 })
  })

  afterEach(() => {
    restoreProcessState()
  })

  test('sets process.exitCode to 1 when package manager exits with code 1', async () => {
    mockPkgMgrProcessResolvedValue = 1
    require('../bin/npq.js')
    await flushPromises()

    expect(process.exitCode).toBe(1)
  })

  test('sets process.exitCode to 0 when package manager exits with code 0', async () => {
    mockPkgMgrProcessResolvedValue = 0
    require('../bin/npq.js')
    await flushPromises()

    expect(process.exitCode).toBe(0)
  })

  test('exits with code 1 for non-TTY warning findings without invoking package manager', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: true,
      json: false,
      disableAutoContinue: false,
      allowNonInteractiveInstall: false,
      installSubcommandExplicit: true
    }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({
      countErrors: 0,
      countWarnings: 1,
      resultsForPlainTextPrint: '',
      summaryForPlainTextPrint: ''
    })
    const pkgMgr = require('../lib/packageManager')

    require('../bin/npq.js')
    await flushPromises()

    expect(CliParser.exit).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 1 }))
    expect(pkgMgr.process).not.toHaveBeenCalled()
  })

  test('uses package manager exit code for opted-in non-TTY warning findings', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode
    mockPkgMgrProcessResolvedValue = 7

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: true,
      json: false,
      disableAutoContinue: false,
      allowNonInteractiveInstall: true,
      installSubcommandExplicit: true
    }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({
      countErrors: 0,
      countWarnings: 1,
      resultsForPlainTextPrint: '',
      summaryForPlainTextPrint: ''
    })
    const pkgMgr = require('../lib/packageManager')

    require('../bin/npq.js')
    await flushPromises()

    expect(CliParser.exit).not.toHaveBeenCalled()
    expect(pkgMgr.process).toHaveBeenCalledWith('npm')
    expect(process.exitCode).toBe(7)
  })

  test('does not invoke package manager when install subcommand is not explicit', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: false,
      json: false,
      disableAutoContinue: false,
      installSubcommandExplicit: false
    }))

    const pkgMgr = require('../lib/packageManager')
    pkgMgr.process.mockClear()

    require('../bin/npq.js')
    await flushPromises()

    expect(pkgMgr.process).not.toHaveBeenCalled()
    expect(CliParser.exit).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 0 }))
  })

  test('audit-only exits with code 1 when marshall reported errors', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: false,
      json: false,
      disableAutoContinue: false,
      installSubcommandExplicit: false
    }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({
      countErrors: 2,
      countWarnings: 0,
      resultsForPlainTextPrint: '',
      summaryForPlainTextPrint: ''
    })

    require('../bin/npq.js')
    await flushPromises()

    expect(CliParser.exit).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 1 }))
  })

  test('audit-only exits with code 1 when marshall reported warnings only', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: false,
      json: false,
      disableAutoContinue: false,
      installSubcommandExplicit: false
    }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({
      countErrors: 0,
      countWarnings: 3,
      resultsForPlainTextPrint: '',
      summaryForPlainTextPrint: ''
    })

    require('../bin/npq.js')
    await flushPromises()

    expect(CliParser.exit).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 1 }))
  })

  test('audit-only with --dry-run exits with code 1 when issues found', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: true,
      plain: false,
      json: false,
      disableAutoContinue: false,
      installSubcommandExplicit: true
    }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({
      countErrors: 1,
      countWarnings: 0,
      resultsForPlainTextPrint: '',
      summaryForPlainTextPrint: ''
    })

    require('../bin/npq.js')
    await flushPromises()

    expect(CliParser.exit).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 1 }))
  })

  test('audit-only prints skipped checks and exits successfully', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = originalExitCode
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['@company/tool'],
      packageManager: 'npm',
      dryRun: false,
      plain: true,
      json: false,
      disableAutoContinue: false,
      installSubcommandExplicit: false
    }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({
      countErrors: 0,
      countWarnings: 0,
      countNotEvaluated: 2,
      resultsForPlainTextPrint: 'skipped-plain',
      summaryForPlainTextPrint: 'summary-plain',
      useRichFormatting: false
    })

    require('../bin/npq.js')
    await flushPromises()

    expect(consoleLog).toHaveBeenCalledWith('Package checks not evaluated:')
    expect(CliParser.exit).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 0 }))

    consoleLog.mockRestore()
  })
})

test('restores process.exit after exit-code tests', () => {
  expect(process.exit).toBe(originalProcessExit)
})

test('restores the entry process.exitCode after exit-code tests', () => {
  expect(process.exitCode).toBe(originalExitCode)
})

test('removes only SIGINT listeners introduced by exit-code tests', () => {
  expect(process.listeners('SIGINT')).toEqual(originalSigintListeners)
})
