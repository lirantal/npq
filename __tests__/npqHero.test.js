'use strict'

jest.mock('../lib/helpers/cliSupportHandler', () => ({
  isEnvSupport: jest.fn().mockReturnValue(true),
  isInteractiveTerminal: jest.fn().mockReturnValue(false),
  noSupportError: jest.fn(),
  packageManagerPassthrough: jest.fn()
}))
jest.mock('../lib/helpers/codingAgentEnvironment', () => ({
  isCodingAgentEnvironment: jest.fn().mockReturnValue(true)
}))
jest.mock('../lib/cli', () => ({
  CliParser: {
    parseArgsMinimal: jest.fn(),
    exit: jest.fn()
  }
}))
jest.mock('../lib/helpers/jsonOutput', () => ({
  createJsonOutput: jest.fn(() => ({ write: jest.fn() }))
}))
jest.mock('../lib/jsonCli', () => ({
  runJsonCli: jest.fn().mockResolvedValue({ status: 'clean' }),
  writeInvalidJsonInvocation: jest.fn()
}))
jest.mock('../lib/helpers/cliSpinner', () => ({
  Spinner: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() }))
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
jest.mock('../lib/helpers/registryConfig', () => ({
  load: jest.fn().mockResolvedValue({ requestOptions: {} })
}))
jest.mock('../lib/helpers/registryClient', () => jest.fn(() => ({ registryFor: jest.fn() })))
jest.mock('../lib/packageManager', () => ({
  process: jest.fn().mockResolvedValue(0)
}))

const originalArgv = process.argv
const originalExitCode = process.exitCode
const originalSigintListeners = process.listeners('SIGINT')
let existingSigintListeners
let CliParser
let isCodingAgentEnvironment
let createJsonOutput
let runJsonCli
let writeInvalidJsonInvocation
let Spinner
let Marshall
let reportResults
let cliPrompt
let RegistryConfig
let RegistryClient
let packageManager

describe('npq-hero routing', () => {
  beforeEach(() => {
    process.argv = [...originalArgv]
    process.exitCode = originalExitCode
    existingSigintListeners = new Set(process.listeners('SIGINT'))
    jest.resetModules()
    jest.clearAllMocks()
    ;({ CliParser } = require('../lib/cli'))
    ;({ isCodingAgentEnvironment } = require('../lib/helpers/codingAgentEnvironment'))
    ;({ createJsonOutput } = require('../lib/helpers/jsonOutput'))
    ;({ runJsonCli, writeInvalidJsonInvocation } = require('../lib/jsonCli'))
    ;({ Spinner } = require('../lib/helpers/cliSpinner'))
    Marshall = require('../lib/marshall')
    ;({ reportResults } = require('../lib/helpers/reportResults'))
    cliPrompt = require('../lib/helpers/cliPrompt.js')
    RegistryConfig = require('../lib/helpers/registryConfig')
    RegistryClient = require('../lib/helpers/registryClient')
    packageManager = require('../lib/packageManager')
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

  test('routes an authorized agent install through the package-manager pipeline', async () => {
    const cliArgs = {
      packages: ['express@latest'],
      registryConfigArgs: [],
      installSubcommandExplicit: true,
      json: false,
      allowNonInteractiveInstall: true
    }
    CliParser.parseArgsMinimal.mockReturnValue(cliArgs)
    reportResults.mockReturnValue({ countErrors: 0, countWarnings: 1 })

    require('../bin/npq-hero.js')
    await new Promise(setImmediate)

    expect(isCodingAgentEnvironment).toHaveBeenCalledTimes(1)
    expect(CliParser.parseArgsMinimal).toHaveBeenCalledWith({ codingAgentEnvironment: true })
    expect(RegistryConfig.load).toHaveBeenCalledWith({ argv: [] })
    expect(RegistryClient).toHaveBeenCalled()
    expect(Marshall).toHaveBeenCalledWith(
      expect.objectContaining({
        pkgs: ['express@latest'],
        registryClient: expect.any(Object)
      })
    )
    expect(reportResults).toHaveBeenCalled()
    expect(packageManager.process).toHaveBeenCalled()
    expect(runJsonCli).not.toHaveBeenCalled()
    expect(Spinner).not.toHaveBeenCalled()
    expect(cliPrompt.prompt).not.toHaveBeenCalled()
    expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
  })

  test('keeps an agent non-install command in the human passthrough pipeline', async () => {
    CliParser.parseArgsMinimal.mockReturnValue({
      packages: [],
      registryConfigArgs: [],
      installSubcommandExplicit: false,
      json: false
    })

    require('../bin/npq-hero.js')
    await new Promise(setImmediate)

    expect(runJsonCli).not.toHaveBeenCalled()
    expect(packageManager.process).toHaveBeenCalled()
  })

  test('sanitizes a marked agent-install parser failure', () => {
    const parserError = Object.assign(new Error('credential in raw input'), {
      npqJsonMode: true
    })
    CliParser.parseArgsMinimal.mockImplementation(() => {
      throw parserError
    })

    expect(() => require('../bin/npq-hero.js')).not.toThrow()
    expect(createJsonOutput).toHaveBeenCalledTimes(1)
    expect(writeInvalidJsonInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ write: expect.any(Function) })
    )
    expect(process.exitCode).toBe(2)
  })
})

test('restores process state after npq-hero routing tests', () => {
  expect(process.argv).toBe(originalArgv)
  expect(process.exitCode).toBe(originalExitCode)
  expect(process.listeners('SIGINT')).toEqual(originalSigintListeners)
})
