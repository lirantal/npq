'use strict'

// Mock the parseArgs function at the top level
const mockParseArgs = jest.fn()
jest.mock('node:util', () => ({
  parseArgs: mockParseArgs
}))

const mockIsCodingAgentEnvironment = jest.fn()
jest.mock('../lib/helpers/codingAgentEnvironment', () => ({
  isCodingAgentEnvironment: mockIsCodingAgentEnvironment
}))

const { CliParser } = require('../lib/cli')

describe('CliParser', () => {
  let originalArgv
  let originalExit
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    // Save original values
    originalArgv = process.argv
    originalExit = process.exit

    // Mock process.exit to prevent actual exit during tests
    process.exit = jest.fn()

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Clear mock history
    mockParseArgs.mockClear()
    mockIsCodingAgentEnvironment.mockReset()
    mockIsCodingAgentEnvironment.mockReturnValue(false)
  })

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv
    process.exit = originalExit

    // Restore console methods
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()

    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('exit method', () => {
    test('should exit with error code and message', () => {
      const mockSpinner = { isSpinning: false, stop: jest.fn() }

      CliParser.exit({
        errorCode: 1,
        message: 'Test error message',
        spinner: mockSpinner
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Test error message')
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    test('should stop spinner if it is spinning', () => {
      const mockSpinner = { isSpinning: true, stop: jest.fn() }

      CliParser.exit({
        errorCode: 0,
        spinner: mockSpinner
      })

      expect(mockSpinner.stop).toHaveBeenCalled()
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    test('should not stop spinner if it is not spinning', () => {
      const mockSpinner = { isSpinning: false, stop: jest.fn() }

      CliParser.exit({
        errorCode: 0,
        spinner: mockSpinner
      })

      expect(mockSpinner.stop).not.toHaveBeenCalled()
    })

    test('should handle missing spinner gracefully', () => {
      CliParser.exit({ errorCode: 0 })
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    test('should exit without message when message is not provided', () => {
      CliParser.exit({ errorCode: 0 })

      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    test('should use -1 as default when errorCode is not a number', () => {
      CliParser.exit({ errorCode: 'invalid' })
      expect(process.exit).toHaveBeenCalledWith(-1)
    })

    test('should use -1 as default when errorCode is not provided', () => {
      CliParser.exit({})
      expect(process.exit).toHaveBeenCalledWith(-1)
    })
  })

  describe('isInstallSubcommand', () => {
    test('returns true for install aliases', () => {
      expect(CliParser.isInstallSubcommand('install')).toBe(true)
      expect(CliParser.isInstallSubcommand('i')).toBe(true)
      expect(CliParser.isInstallSubcommand('add')).toBe(true)
      expect(CliParser.isInstallSubcommand('isntall')).toBe(true)
    })

    test('returns false for package names and other tokens', () => {
      expect(CliParser.isInstallSubcommand('express')).toBe(false)
      expect(CliParser.isInstallSubcommand('build')).toBe(false)
    })
  })

  describe('_extractPackagesFromPositionals', () => {
    test('should extract packages from install command', () => {
      const positionals = ['install', 'express', 'lodash@4.17.21']
      const result = CliParser._extractPackagesFromPositionals(positionals)

      expect(result).toEqual(['express@latest', 'lodash@4.17.21'])
    })

    test('should handle various install command aliases', () => {
      const commands = [
        'i',
        'add',
        'isntall',
        'in',
        'ins',
        'inst',
        'insta',
        'instal',
        'isnt',
        'isnta',
        'isntal'
      ]

      commands.forEach((command) => {
        const positionals = [command, 'express']
        const result = CliParser._extractPackagesFromPositionals(positionals)
        expect(result).toEqual(['express@latest'])
      })
    })

    test('should treat first positional as package when no explicit command', () => {
      const positionals = ['express', 'lodash']
      const result = CliParser._extractPackagesFromPositionals(positionals)

      expect(result).toEqual(['express@latest', 'lodash@latest'])
    })

    test('should handle version modifiers correctly', () => {
      const positionals = ['install', 'express@*', 'lodash@^4.0.0', 'react@~16.0.0']
      const result = CliParser._extractPackagesFromPositionals(positionals)

      expect(result).toEqual(['express@latest', 'lodash@^4.0.0', 'react@~16.0.0'])
    })

    test('should return empty array when no packages provided', () => {
      const positionals = ['install']
      const result = CliParser._extractPackagesFromPositionals(positionals)

      expect(result).toEqual([])
    })

    test('should return empty array when no positionals provided', () => {
      const positionals = []
      const result = CliParser._extractPackagesFromPositionals(positionals)

      expect(result).toEqual([])
    })

    test('should handle scoped packages', () => {
      const positionals = ['install', '@scope/package', '@another/package@1.0.0']
      const result = CliParser._extractPackagesFromPositionals(positionals)

      expect(result).toEqual(['@scope/package@latest', '@another/package@1.0.0'])
    })

    test('should exit early when earlyExitNoInstall is true and no install command', () => {
      const positionals = ['build', 'test']
      const result = CliParser._extractPackagesFromPositionals(positionals, true)

      expect(result).toEqual([])
    })

    test('should still extract packages with install command when earlyExitNoInstall is true', () => {
      const positionals = ['install', 'express']
      const result = CliParser._extractPackagesFromPositionals(positionals, true)

      expect(result).toEqual(['express@latest'])
    })
  })

  describe('parseArgsFull', () => {
    test('returns standard registry configuration arguments', () => {
      mockParseArgs.mockReturnValue({
        values: {
          registry: 'https://artifactory.example.test/api/npm/npm/',
          userconfig: '/tmp/user.npmrc',
          globalconfig: '/tmp/global.npmrc'
        },
        positionals: ['install', '@company/tool']
      })

      expect(CliParser.parseArgsFull().registryConfigArgs).toEqual([
        '--registry=https://artifactory.example.test/api/npm/npm/',
        '--userconfig=/tmp/user.npmrc',
        '--globalconfig=/tmp/global.npmrc'
      ])
    })

    test('should display help when --help flag is provided', () => {
      mockParseArgs.mockReturnValue({
        values: { help: true },
        positionals: []
      })

      CliParser.parseArgsFull()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: npq install <package> [options]')
      )
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    test('describes JSON as audit-only in help', () => {
      mockParseArgs.mockReturnValue({ values: { help: true }, positionals: [] })
      CliParser.parseArgsFull()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('--json                  Emit JSON and never install')
      )
    })

    test('should display version when --version flag is provided', () => {
      mockParseArgs.mockReturnValue({
        values: { version: true },
        positionals: []
      })

      CliParser.parseArgsFull()

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\d+\.\d+\.\d+/)) // Version pattern
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    test('should parse packages and options correctly', () => {
      mockParseArgs.mockReturnValue({
        values: {
          'dry-run': true,
          plain: true,
          packageManager: 'yarn'
        },
        positionals: ['install', 'express', 'lodash']
      })

      const result = CliParser.parseArgsFull()

      expect(result).toEqual({
        packages: ['express@latest', 'lodash@latest'],
        packageManager: 'yarn',
        dryRun: true,
        plain: true,
        json: false,
        allowNonInteractiveInstall: false,
        disableAutoContinue: false,
        registryConfigArgs: [],
        installSubcommandExplicit: true
      })
    })

    test('should use pkgMgr alias for packageManager', () => {
      mockParseArgs.mockReturnValue({
        values: { pkgMgr: 'pnpm' },
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.packageManager).toBe('pnpm')
    })

    test('should prioritize packageManager over pkgMgr', () => {
      mockParseArgs.mockReturnValue({
        values: {
          packageManager: 'yarn',
          pkgMgr: 'pnpm'
        },
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.packageManager).toBe('yarn')
    })

    test('should use NPQ_PKG_MGR environment variable', () => {
      process.env.NPQ_PKG_MGR = 'pnpm'

      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.packageManager).toBe('pnpm')

      // Cleanup
      delete process.env.NPQ_PKG_MGR
    })

    test('should default to npm when no package manager specified', () => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.packageManager).toBe('npm')
    })

    test('should set default values for dryRun and plain', () => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.dryRun).toBe(false)
      expect(result.plain).toBe(false)
      expect(result.disableAutoContinue).toBe(false)
    })

    test('enables JSON audit mode', () => {
      mockParseArgs.mockReturnValue({
        values: { json: true },
        positionals: ['install', 'express']
      })

      expect(CliParser.parseArgsFull()).toEqual({
        packages: ['express@latest'],
        packageManager: 'npm',
        dryRun: false,
        plain: false,
        json: true,
        allowNonInteractiveInstall: false,
        disableAutoContinue: false,
        registryConfigArgs: [],
        installSubcommandExplicit: true
      })
    })

    test('enables ordinary non-interactive installation from the CLI flag', () => {
      mockParseArgs.mockReturnValue({
        values: { 'allow-non-interactive-install': true },
        positionals: ['install', 'express']
      })

      expect(CliParser.parseArgsFull().allowNonInteractiveInstall).toBe(true)
    })

    test('enables ordinary non-interactive installation from the environment', () => {
      process.env.NPQ_ALLOW_NON_INTERACTIVE_INSTALL = 'true'
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsFull().allowNonInteractiveInstall).toBe(true)
      delete process.env.NPQ_ALLOW_NON_INTERACTIVE_INSTALL
    })

    test('uses coding-agent detection as authorization for explicit installs', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsFull()).toEqual(
        expect.objectContaining({
          json: false,
          allowNonInteractiveInstall: true,
          installSubcommandExplicit: true
        })
      )
    })

    test('keeps a coding-agent audit without an install command in JSON mode', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['express'] })

      expect(CliParser.parseArgsFull()).toEqual(
        expect.objectContaining({ json: true, allowNonInteractiveInstall: false })
      )
    })

    test('explicit JSON wins over coding-agent install authorization', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: { json: true }, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsFull()).toEqual(
        expect.objectContaining({ json: true, allowNonInteractiveInstall: false })
      )
    })

    test('uses JSON-safe package parsing when detection enables JSON mode', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'https://user:credential@example.test/package.tgz']
      })

      expect(() => CliParser.parseArgsFull()).toThrow('Invalid JSON package input')
    })

    test('keeps explicit JSON mode when no coding agent is detected', () => {
      mockParseArgs.mockReturnValue({
        values: { json: true },
        positionals: ['install', 'express']
      })

      expect(CliParser.parseArgsFull().json).toBe(true)
    })

    test.each([
      'https://user:credential@example.test/package.tgz',
      'git+https://user:credential@example.test/repository.git',
      'file:/private/project/package.tgz',
      '../private/project',
      'alias-name@npm:express@1.0.0'
    ])('rejects non-registry JSON package input before normalization', (packageSpec) => {
      mockParseArgs.mockReturnValue({
        values: { json: true },
        positionals: ['install', packageSpec]
      })

      expect(() => CliParser.parseArgsFull()).toThrow('Invalid JSON package input')
    })

    test.each([
      'https://example.test/package.tgz',
      'git+https://example.test/repository.git',
      'file:/tmp/package.tgz',
      '../package',
      'alias-name@npm:express@1.0.0'
    ])('preserves human-mode support for %s', (packageSpec) => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', packageSpec]
      })

      expect(() => CliParser.parseArgsFull()).not.toThrow()
    })

    test('defaults JSON audit mode to false', () => {
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['express'] })
      expect(CliParser.parseArgsFull().json).toBe(false)
    })

    test('should set disableAutoContinue to true when --disable-auto-continue flag is provided', () => {
      mockParseArgs.mockReturnValue({
        values: { 'disable-auto-continue': true },
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.disableAutoContinue).toBe(true)
    })

    test('should set disableAutoContinue to true when NPQ_DISABLE_AUTO_CONTINUE env var is true', () => {
      process.env.NPQ_DISABLE_AUTO_CONTINUE = 'true'

      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.disableAutoContinue).toBe(true)

      // Cleanup
      delete process.env.NPQ_DISABLE_AUTO_CONTINUE
    })

    test('should not set disableAutoContinue when NPQ_DISABLE_AUTO_CONTINUE is not "true"', () => {
      process.env.NPQ_DISABLE_AUTO_CONTINUE = 'false'

      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.disableAutoContinue).toBe(false)

      // Cleanup
      delete process.env.NPQ_DISABLE_AUTO_CONTINUE
    })

    test('should prefer CLI flag over environment variable for disableAutoContinue', () => {
      process.env.NPQ_DISABLE_AUTO_CONTINUE = 'false'

      mockParseArgs.mockReturnValue({
        values: { 'disable-auto-continue': true },
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.disableAutoContinue).toBe(true)

      // Cleanup
      delete process.env.NPQ_DISABLE_AUTO_CONTINUE
    })

    test('should set installSubcommandExplicit false when no positionals', () => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: []
      })

      const result = CliParser.parseArgsFull()

      expect(result.installSubcommandExplicit).toBe(false)
    })

    test('should set installSubcommandExplicit false when first token is a package name', () => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['express']
      })

      const result = CliParser.parseArgsFull()

      expect(result.installSubcommandExplicit).toBe(false)
    })

    test('should set installSubcommandExplicit true when first token is install or i', () => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install']
      })
      expect(CliParser.parseArgsFull().installSubcommandExplicit).toBe(true)

      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['i', 'lodash']
      })
      expect(CliParser.parseArgsFull().installSubcommandExplicit).toBe(true)
    })
  })

  describe('parseArgsMinimal', () => {
    test('returns standard registry configuration arguments', () => {
      mockParseArgs.mockReturnValue({
        values: {
          registry: 'https://artifactory.example.test/api/npm/npm/'
        },
        positionals: ['install', '@company/tool']
      })

      expect(CliParser.parseArgsMinimal().registryConfigArgs).toEqual([
        '--registry=https://artifactory.example.test/api/npm/npm/'
      ])
    })

    test('should extract packages with install command', () => {
      mockParseArgs.mockReturnValue({
        positionals: ['install', 'express', 'lodash']
      })

      const result = CliParser.parseArgsMinimal()

      expect(result).toEqual({
        packages: ['express@latest', 'lodash@latest'],
        registryConfigArgs: [],
        installSubcommandExplicit: true,
        json: false,
        allowNonInteractiveInstall: false
      })
    })

    test('should return empty packages array when no install command', () => {
      mockParseArgs.mockReturnValue({
        positionals: ['build', 'test']
      })

      const result = CliParser.parseArgsMinimal()

      expect(result).toEqual({
        packages: [],
        registryConfigArgs: [],
        installSubcommandExplicit: false,
        json: false,
        allowNonInteractiveInstall: false
      })
    })

    test('should return empty packages array when no positionals', () => {
      mockParseArgs.mockReturnValue({
        positionals: []
      })

      const result = CliParser.parseArgsMinimal()

      expect(result).toEqual({
        packages: [],
        registryConfigArgs: [],
        installSubcommandExplicit: false,
        json: false,
        allowNonInteractiveInstall: false
      })
    })

    test('authorizes a coding-agent install without selecting JSON output mode', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

      expect(CliParser.parseArgsMinimal()).toEqual({
        packages: ['express@latest'],
        registryConfigArgs: [],
        installSubcommandExplicit: true,
        json: false,
        allowNonInteractiveInstall: true
      })
    })

    test('keeps agent-driven non-install commands in passthrough mode', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({ values: {}, positionals: ['run', 'build'] })

      expect(CliParser.parseArgsMinimal()).toEqual({
        packages: [],
        registryConfigArgs: [],
        installSubcommandExplicit: false,
        json: false,
        allowNonInteractiveInstall: false
      })
    })

    test('marks invalid agent install input for safe JSON error routing', () => {
      mockIsCodingAgentEnvironment.mockReturnValue(true)
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'https://user:credential@example.test/package.tgz']
      })

      expect.assertions(2)
      try {
        CliParser.parseArgsMinimal()
      } catch (error) {
        expect(error.message).toBe('Invalid JSON package input')
        expect(error.npqJsonMode).toBe(true)
      }
    })

    test('preserves human parsing for install package types outside JSON mode', () => {
      mockParseArgs.mockReturnValue({
        values: {},
        positionals: ['install', 'https://example.test/package.tgz']
      })

      expect(() => CliParser.parseArgsMinimal()).not.toThrow()
    })
  })

  describe('Integration tests', () => {
    test('should handle complex package specifications', () => {
      mockParseArgs.mockReturnValue({
        values: { packageManager: 'yarn' },
        positionals: [
          'install',
          'express@4.18.2',
          '@types/node@^18.0.0',
          'lodash@*',
          '@babel/core',
          'react@~17.0.0'
        ]
      })

      const result = CliParser.parseArgsFull()

      expect(result.packages).toEqual([
        'express@4.18.2',
        '@types/node@^18.0.0',
        'lodash@latest',
        '@babel/core@latest',
        'react@~17.0.0'
      ])
    })

    test('should handle all command line flags together', () => {
      mockParseArgs.mockReturnValue({
        values: {
          'dry-run': true,
          plain: true,
          packageManager: 'yarn',
          pkgMgr: 'npm' // Should be overridden by packageManager
        },
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result).toEqual({
        packages: ['express@latest'],
        packageManager: 'yarn',
        dryRun: true,
        plain: true,
        json: false,
        allowNonInteractiveInstall: false,
        disableAutoContinue: false,
        registryConfigArgs: [],
        installSubcommandExplicit: true
      })
    })

    test('should handle all command line flags together including disable-auto-continue', () => {
      mockParseArgs.mockReturnValue({
        values: {
          'dry-run': true,
          plain: true,
          packageManager: 'yarn',
          'disable-auto-continue': true
        },
        positionals: ['install', 'express']
      })

      const result = CliParser.parseArgsFull()

      expect(result).toEqual({
        packages: ['express@latest'],
        packageManager: 'yarn',
        dryRun: true,
        plain: true,
        json: false,
        allowNonInteractiveInstall: false,
        disableAutoContinue: true,
        registryConfigArgs: [],
        installSubcommandExplicit: true
      })
    })
  })
})
