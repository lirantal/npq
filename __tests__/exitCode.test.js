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

jest.mock('../lib/helpers/registryConfig', () => ({
  load: jest.fn().mockResolvedValue({ requestOptions: {} })
}))

jest.mock('../lib/helpers/registryClient', () =>
  jest.fn().mockImplementation(() => ({ registryFor: jest.fn() }))
)

jest.mock('../lib/helpers/promiseThrottler', () => ({
  promiseThrottleHelper: jest.fn()
}))

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {})

let mockPkgMgrProcessResolvedValue = 0
jest.mock('../lib/packageManager', () => ({
  process: jest.fn(() => Promise.resolve(mockPkgMgrProcessResolvedValue))
}))

const mockNpqCliArgs = {
  packages: ['express'],
  packageManager: 'npm',
  dryRun: false,
  plain: false,
  disableAutoContinue: false,
  installSubcommandExplicit: true
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

describe('npq-hero exit code propagation', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = undefined
    mockPkgMgrProcessResolvedValue = 0

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsMinimal.mockReturnValue({ packages: [] })
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

  test('loads and injects registry configuration', async () => {
    const { CliParser } = require('../lib/cli')
    const RegistryConfig = require('../lib/helpers/registryConfig')
    const RegistryClient = require('../lib/helpers/registryClient')
    const Marshall = require('../lib/marshall')
    CliParser.parseArgsMinimal.mockReturnValue({
      packages: ['@company/tool'],
      registryConfigArgs: [
        '--registry=https://artifactory.example.test/api/npm/npm/'
      ]
    })

    require('../bin/npq-hero.js')
    await flushPromises()

    expect(RegistryConfig.load).toHaveBeenCalledWith({
      argv: ['--registry=https://artifactory.example.test/api/npm/npm/']
    })
    expect(RegistryClient).toHaveBeenCalled()
    expect(Marshall).toHaveBeenCalledWith(
      expect.objectContaining({ registryClient: expect.any(Object) })
    )
  })

  test('prints skipped checks and installs without prompting', async () => {
    const { CliParser } = require('../lib/cli')
    const { reportResults } = require('../lib/helpers/reportResults')
    const cliPrompt = require('../lib/helpers/cliPrompt.js')
    const pkgMgr = require('../lib/packageManager')
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
    CliParser.parseArgsMinimal.mockReturnValue({ packages: ['@company/tool'] })
    reportResults.mockReturnValue({
      countErrors: 0,
      countWarnings: 0,
      countNotEvaluated: 2,
      resultsForPlainTextPrint: 'skipped-plain',
      summaryForPlainTextPrint: 'summary-plain',
      useRichFormatting: false
    })

    require('../bin/npq-hero.js')
    await flushPromises()

    expect(consoleLog).toHaveBeenCalledWith('Package checks not evaluated:')
    expect(consoleLog).toHaveBeenCalledWith('skipped-plain')
    expect(cliPrompt.prompt).not.toHaveBeenCalled()
    expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
    expect(pkgMgr.process).toHaveBeenCalled()

    consoleLog.mockRestore()
  })
})

describe('npq exit code propagation', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = undefined
    mockPkgMgrProcessResolvedValue = 0
    mockNpqCliArgs.installSubcommandExplicit = true
    mockNpqCliArgs.dryRun = false

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({ ...mockNpqCliArgs }))

    const { reportResults } = require('../lib/helpers/reportResults')
    reportResults.mockReturnValue({ countErrors: 0, countWarnings: 0 })
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

  test('does not invoke package manager when install subcommand is not explicit', async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockProcessExit.mockClear()
    process.exitCode = undefined

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: false,
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
    process.exitCode = undefined

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: false,
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
    process.exitCode = undefined

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: false,
      plain: false,
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
    process.exitCode = undefined

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['express'],
      packageManager: 'npm',
      dryRun: true,
      plain: false,
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
    process.exitCode = undefined
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

    const { CliParser } = require('../lib/cli')
    CliParser.parseArgsFull.mockImplementation(() => ({
      packages: ['@company/tool'],
      packageManager: 'npm',
      dryRun: false,
      plain: true,
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
