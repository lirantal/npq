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
let existingSigintListeners

describe('npq CLI script', () => {
  beforeEach(() => {
    process.argv = [...originalArgv]
    process.exitCode = undefined
    existingSigintListeners = new Set(process.listeners('SIGINT'))
    // Reset modules to ensure mocks are fresh for each test.
    jest.resetModules()
    // Clear mock history on the shared instance and the constructor.
    const { Spinner } = require('../lib/helpers/cliSpinner')
    mockSpinnerInstance.start.mockClear()
    mockSpinnerInstance.stop.mockClear()
    Spinner.mockClear()
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = undefined
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

    CliParser.parseArgsFull.mockReturnValue({
      packages: ['express'],
      plain: false,
      dryRun: true,
      json: false
    })
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

    CliParser.parseArgsFull.mockReturnValue({
      packages: ['express'],
      plain: true,
      dryRun: true,
      json: false
    })
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

    CliParser.parseArgsFull.mockReturnValue({
      packages: ['express'],
      plain: false,
      dryRun: true,
      json: false
    })
    isInteractiveTerminal.mockReturnValue(false)

    // Act
    require('../bin/npq.js')
    await new Promise(process.nextTick)

    // Assert
    expect(Spinner).not.toHaveBeenCalled()
    expect(mockSpinnerInstance.start).not.toHaveBeenCalled()
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
