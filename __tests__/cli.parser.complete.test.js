'use strict'

// Mock the parseArgs function at the top level
const mockParseArgs = jest.fn()
jest.mock('node:util', () => ({
  parseArgs: mockParseArgs
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
        disableAutoContinue: false
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
  })

  describe('parseArgsMinimal', () => {
    test('should extract packages with install command', () => {
      mockParseArgs.mockReturnValue({
        positionals: ['install', 'express', 'lodash']
      })

      const result = CliParser.parseArgsMinimal()

      expect(result).toEqual({
        packages: ['express@latest', 'lodash@latest']
      })
    })

    test('should return empty packages array when no install command', () => {
      mockParseArgs.mockReturnValue({
        positionals: ['build', 'test']
      })

      const result = CliParser.parseArgsMinimal()

      expect(result).toEqual({
        packages: []
      })
    })

    test('should return empty packages array when no positionals', () => {
      mockParseArgs.mockReturnValue({
        positionals: []
      })

      const result = CliParser.parseArgsMinimal()

      expect(result).toEqual({
        packages: []
      })
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
        disableAutoContinue: false
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
        disableAutoContinue: true
      })
    })
  })
})
