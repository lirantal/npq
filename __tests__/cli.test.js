// __tests__/cli.test.js

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

describe('npq CLI script', () => {
  beforeEach(() => {
    // Reset modules to ensure mocks are fresh for each test.
    jest.resetModules()
    // Clear mock history on the shared instance and the constructor.
    const { Spinner } = require('../lib/helpers/cliSpinner')
    mockSpinnerInstance.start.mockClear()
    mockSpinnerInstance.stop.mockClear()
    Spinner.mockClear()
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
})
