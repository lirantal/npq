// __tests__/cli.test.js

'use strict'

// Mock dependencies. These are hoisted by Jest.
jest.mock('../lib/cli', () => ({
  CliParser: {
    parseArgsFull: jest.fn(),
    exit: jest.fn()
  }
}))
jest.mock('../lib/helpers/cliSupportHandler', () => ({
  isEnvSupport: jest.fn().mockReturnValue(true),
  isInteractiveTerminal: jest.fn(),
  noSupportError: jest.fn()
}))
const mockIsCodingAgentEnvironment = jest.fn()
jest.mock('../lib/helpers/codingAgentEnvironment', () => ({
  isCodingAgentEnvironment: mockIsCodingAgentEnvironment
}))

// Create a shared mock for the spinner instance that we can inspect in tests.
const mockSpinnerInstance = {
  start: jest.fn(),
  stop: jest.fn()
}
jest.mock('../lib/helpers/cliSpinner', () => ({
  // The Spinner property is a mock constructor that returns our shared mock instance.
  Spinner: jest.fn().mockImplementation(() => mockSpinnerInstance)
}))

jest.mock('../lib/helpers/sourcePackages', () => ({
  getProjectPackages: jest.fn().mockResolvedValue(['express'])
}))
const mockRegistryConfig = { requestOptions: {} }
const mockRegistryClientInstance = { registryFor: jest.fn() }
jest.mock('../lib/helpers/registryConfig', () => ({
  load: jest.fn().mockResolvedValue(mockRegistryConfig)
}))
jest.mock('../lib/helpers/registryClient', () =>
  jest.fn().mockImplementation(() => mockRegistryClientInstance)
)
jest.mock('../lib/marshall', () =>
  jest.fn(() => ({
    process: jest.fn().mockResolvedValue({})
  }))
)
jest.mock('../lib/helpers/reportResults', () => ({
  reportResults: jest.fn().mockReturnValue({ countErrors: 0, countWarnings: 0 })
}))
jest.mock('../lib/packageManager', () => ({
  process: jest.fn()
}))
jest.mock('../lib/helpers/cliPrompt.js', () => ({
  prompt: jest.fn().mockResolvedValue({ install: true }),
  autoContinue: jest.fn().mockResolvedValue({ install: true })
}))
jest.mock('../lib/jsonCli', () => ({
  runJsonCli: jest.fn().mockResolvedValue({ status: 'clean' }),
  writeInvalidJsonInvocation: jest.fn()
}))

const originalArgv = process.argv
const originalExitCode = process.exitCode
const originalSigintListeners = process.listeners('SIGINT')
let existingSigintListeners

describe('npq CLI script', () => {
  beforeEach(() => {
    process.argv = [...originalArgv]
    process.exitCode = originalExitCode
    existingSigintListeners = new Set(process.listeners('SIGINT'))
    // Reset modules to ensure mocks are fresh for each test.
    jest.resetModules()
    mockIsCodingAgentEnvironment.mockReset()
    mockIsCodingAgentEnvironment.mockReturnValue(false)
    // Clear mock history on the shared instance and the constructor.
    const { Spinner } = require('../lib/helpers/cliSpinner')
    mockSpinnerInstance.start.mockClear()
    mockSpinnerInstance.stop.mockClear()
    Spinner.mockClear()
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = originalExitCode
    for (const listener of process.listeners('SIGINT')) {
      if (!existingSigintListeners.has(listener)) {
        process.removeListener('SIGINT', listener)
      }
    }
    jest.restoreAllMocks()
  })

  test('should initialize and start spinner in interactive mode without --plain flag', async () => {
    // Arrange
    const { CliParser } = require('../lib/cli')
    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
    const { Spinner } = require('../lib/helpers/cliSpinner')

    CliParser.parseArgsFull.mockReturnValue({ packages: ['express'], plain: false, dryRun: true })
    isInteractiveTerminal.mockReturnValue(true)

    // Act: Dynamically require the script to run it.
    require('../bin/npq.js')
    // Wait for async operations in the script to settle.
    await new Promise(process.nextTick)

    // Assert
    expect(Spinner).toHaveBeenCalledTimes(1)
    expect(mockSpinnerInstance.start).toHaveBeenCalledTimes(1)
  })

  test('should not initialize spinner when --plain flag is used', async () => {
    // Arrange
    const { CliParser } = require('../lib/cli')
    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
    const { Spinner } = require('../lib/helpers/cliSpinner')

    CliParser.parseArgsFull.mockReturnValue({ packages: ['express'], plain: true, dryRun: true })
    isInteractiveTerminal.mockReturnValue(true)

    // Act
    require('../bin/npq.js')
    await new Promise(process.nextTick)

    // Assert
    expect(Spinner).not.toHaveBeenCalled()
    expect(mockSpinnerInstance.start).not.toHaveBeenCalled()
  })

  test('should not initialize spinner in non-interactive mode', async () => {
    // Arrange
    const { CliParser } = require('../lib/cli')
    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
    const { Spinner } = require('../lib/helpers/cliSpinner')

    CliParser.parseArgsFull.mockReturnValue({ packages: ['express'], plain: false, dryRun: true })
    isInteractiveTerminal.mockReturnValue(false)

    // Act
    require('../bin/npq.js')
    await new Promise(process.nextTick)

    // Assert
    expect(Spinner).not.toHaveBeenCalled()
    expect(mockSpinnerInstance.start).not.toHaveBeenCalled()
  })

  test('loads and injects registry configuration before auditing', async () => {
    const { CliParser } = require('../lib/cli')
    const RegistryConfig = require('../lib/helpers/registryConfig')
    const RegistryClient = require('../lib/helpers/registryClient')
    const Marshall = require('../lib/marshall')

    CliParser.parseArgsFull.mockReturnValue({
      packages: ['@company/tool'],
      plain: true,
      dryRun: true,
      registryConfigArgs: ['--registry=https://artifactory.example.test/api/npm/npm/']
    })

    require('../bin/npq.js')
    await new Promise(setImmediate)

    expect(RegistryConfig.load).toHaveBeenCalledWith({
      argv: ['--registry=https://artifactory.example.test/api/npm/npm/']
    })
    expect(RegistryClient).toHaveBeenCalledWith(mockRegistryConfig)
    expect(Marshall).toHaveBeenCalledWith(
      expect.objectContaining({
        registryClient: mockRegistryClientInstance
      })
    )
  })

  test('exits without auditing when registry configuration fails', async () => {
    const { CliParser } = require('../lib/cli')
    const RegistryConfig = require('../lib/helpers/registryConfig')
    const Marshall = require('../lib/marshall')
    const pkgMgr = require('../lib/packageManager')
    RegistryConfig.load.mockRejectedValueOnce(
      Object.assign(new Error('Invalid npm registry configuration'), {
        code: 'EREGISTRYCONFIG'
      })
    )
    CliParser.parseArgsFull.mockReturnValue({
      packages: ['@company/tool'],
      plain: true,
      dryRun: true,
      registryConfigArgs: []
    })

    require('../bin/npq.js')
    await new Promise(setImmediate)

    expect(CliParser.exit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid npm registry configuration'
      })
    )
    expect(Marshall).not.toHaveBeenCalled()
    expect(pkgMgr.process).not.toHaveBeenCalled()
  })

  test('prints skipped checks and continues an explicit install without prompting', async () => {
    const { CliParser } = require('../lib/cli')
    const { reportResults } = require('../lib/helpers/reportResults')
    const cliPrompt = require('../lib/helpers/cliPrompt.js')
    const pkgMgr = require('../lib/packageManager')
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

    CliParser.parseArgsFull.mockReturnValue({
      packages: ['@company/tool'],
      packageManager: 'pnpm',
      plain: true,
      dryRun: false,
      disableAutoContinue: false,
      installSubcommandExplicit: true
    })
    reportResults.mockReturnValue({
      countErrors: 0,
      countWarnings: 0,
      countNotEvaluated: 2,
      resultsForPlainTextPrint: 'skipped-plain',
      summaryForPlainTextPrint: 'summary-plain',
      useRichFormatting: false
    })

    require('../bin/npq.js')
    await new Promise(setImmediate)

    expect(consoleLog).toHaveBeenCalledWith('Package checks not evaluated:')
    expect(consoleLog).toHaveBeenCalledWith('skipped-plain')
    expect(cliPrompt.prompt).not.toHaveBeenCalled()
    expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
    expect(pkgMgr.process).toHaveBeenCalledWith('pnpm')
  })

  test('still follows warning behavior when skipped checks accompany a warning', async () => {
    const { CliParser } = require('../lib/cli')
    const { reportResults } = require('../lib/helpers/reportResults')
    const cliPrompt = require('../lib/helpers/cliPrompt.js')
    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

    isInteractiveTerminal.mockReturnValue(true)
    CliParser.parseArgsFull.mockReturnValue({
      packages: ['@company/tool'],
      packageManager: 'npm',
      plain: true,
      dryRun: false,
      disableAutoContinue: false,
      allowNonInteractiveInstall: false,
      installSubcommandExplicit: true
    })
    reportResults.mockReturnValue({
      countErrors: 0,
      countWarnings: 1,
      countNotEvaluated: 2,
      resultsForPlainTextPrint: 'mixed-plain',
      summaryForPlainTextPrint: 'summary-plain',
      useRichFormatting: false
    })

    require('../bin/npq.js')
    await new Promise(setImmediate)

    expect(consoleLog).toHaveBeenCalledWith('Packages with issues found:')
    expect(cliPrompt.autoContinue).toHaveBeenCalled()
  })

  test('rejects non-TTY warning findings without invoking the package manager', async () => {
    const { CliParser } = require('../lib/cli')
    const cliPrompt = require('../lib/helpers/cliPrompt.js')
    const pkgMgr = require('../lib/packageManager')
    const { reportResults } = require('../lib/helpers/reportResults')
    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

    isInteractiveTerminal.mockReturnValue(false)
    CliParser.parseArgsFull.mockReturnValue({
      packages: ['express'],
      packageManager: 'npm',
      plain: true,
      dryRun: false,
      json: false,
      disableAutoContinue: false,
      allowNonInteractiveInstall: false,
      installSubcommandExplicit: true
    })
    reportResults.mockReturnValue({ countErrors: 0, countWarnings: 1 })

    require('../bin/npq.js')
    await new Promise(setImmediate)

    expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
    expect(pkgMgr.process).not.toHaveBeenCalled()
    expect(CliParser.exit).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 1 }))
  })

  test('allows opted-in non-TTY warning findings without prompting', async () => {
    const { CliParser } = require('../lib/cli')
    const cliPrompt = require('../lib/helpers/cliPrompt.js')
    const pkgMgr = require('../lib/packageManager')
    const { reportResults } = require('../lib/helpers/reportResults')
    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

    isInteractiveTerminal.mockReturnValue(false)
    CliParser.parseArgsFull.mockReturnValue({
      packages: ['express'],
      packageManager: 'npm',
      plain: true,
      dryRun: false,
      json: false,
      disableAutoContinue: false,
      allowNonInteractiveInstall: true,
      installSubcommandExplicit: true
    })
    reportResults.mockReturnValue({ countErrors: 0, countWarnings: 1 })

    require('../bin/npq.js')
    await new Promise(setImmediate)

    expect(cliPrompt.prompt).not.toHaveBeenCalled()
    expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
    expect(pkgMgr.process).toHaveBeenCalledWith('npm')
  })

  test('routes explicit-install JSON requests away from the human pipeline', async () => {
    const { CliParser } = require('../lib/cli')
    const { Spinner } = require('../lib/helpers/cliSpinner')
    const { reportResults } = require('../lib/helpers/reportResults')
    const cliPrompt = require('../lib/helpers/cliPrompt.js')
    const pkgMgr = require('../lib/packageManager')
    const { runJsonCli } = require('../lib/jsonCli')
    const cliArgs = {
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: false,
      json: true,
      disableAutoContinue: false,
      installSubcommandExplicit: true
    }
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    process.argv = [...originalArgv, '--json', 'install', 'express']
    CliParser.parseArgsFull.mockReturnValue(cliArgs)

    require('../bin/npq.js')
    await new Promise(process.nextTick)

    expect(runJsonCli).toHaveBeenCalledTimes(1)
    expect(runJsonCli).toHaveBeenCalledWith(cliArgs, {
      output: expect.objectContaining({ write: expect.any(Function) })
    })
    expect(Spinner).not.toHaveBeenCalled()
    expect(reportResults).not.toHaveBeenCalled()
    expect(cliPrompt.prompt).not.toHaveBeenCalled()
    expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
    expect(pkgMgr.process).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })

  test('creates JSON output for an automatically detected coding agent', async () => {
    const { CliParser } = require('../lib/cli')
    const { runJsonCli } = require('../lib/jsonCli')
    const cliArgs = {
      packages: ['express@latest'],
      json: true,
      installSubcommandExplicit: true
    }
    mockIsCodingAgentEnvironment.mockReturnValue(true)
    CliParser.parseArgsFull.mockReturnValue(cliArgs)

    require('../bin/npq.js')
    await new Promise(process.nextTick)

    expect(runJsonCli).toHaveBeenCalledWith(cliArgs, {
      output: expect.objectContaining({ write: expect.any(Function) })
    })
  })

  test('routes raw JSON parser failures to invalid-invocation output synchronously', () => {
    const { CliParser } = require('../lib/cli')
    const { runJsonCli, writeInvalidJsonInvocation } = require('../lib/jsonCli')
    const parserError = new Error('raw parser detail')
    process.argv = [...originalArgv, '--json', 'not a valid package']
    CliParser.parseArgsFull.mockImplementation(() => {
      throw parserError
    })

    expect(() => require('../bin/npq.js')).not.toThrow()

    expect(writeInvalidJsonInvocation).toHaveBeenCalledTimes(1)
    expect(writeInvalidJsonInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ write: expect.any(Function) })
    )
    expect(runJsonCli).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(2)
  })
})

test('restores process state after CLI routing tests', () => {
  expect(process.argv).toBe(originalArgv)
  expect(process.exitCode).toBe(originalExitCode)
  expect(process.listeners('SIGINT')).toEqual(originalSigintListeners)
})
