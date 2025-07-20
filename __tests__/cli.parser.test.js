// __tests__/env-var-integration.test.js

describe('NPQ_PKG_MGR Environment Variable Integration', () => {
  let originalArgv
  let originalNPQ_PKG_MGR

  beforeEach(() => {
    // Save original values
    originalArgv = process.argv
    originalNPQ_PKG_MGR = process.env.NPQ_PKG_MGR

    // Clear environment variable
    delete process.env.NPQ_PKG_MGR

    // Mock console methods to avoid output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(process, 'exit').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv
    if (originalNPQ_PKG_MGR !== undefined) {
      process.env.NPQ_PKG_MGR = originalNPQ_PKG_MGR
    } else {
      delete process.env.NPQ_PKG_MGR
    }

    // Restore mocked methods
    jest.restoreAllMocks()
  })

  test.only('should prioritize NPQ_PKG_MGR environment variable over command line options', () => {
    // This test verifies the core functionality:
    // process.env.NPQ_PKG_MGR || values.packageManager || values.pkgMgr || 'npm'

    process.env.NPQ_PKG_MGR = 'pnpm'

    // Dynamically require to get fresh instance with environment variable set
    jest.resetModules()
    const { CliParser } = require('../lib/cli')

    // Mock parseArgs to simulate command line input with --packageManager
    const originalParseArgs = require('node:util').parseArgs
    require('node:util').parseArgs = jest.fn().mockReturnValue({
      values: { packageManager: 'yarn' }, // CLI says yarn
      positionals: ['install', 'express']
    })

    const result = CliParser.parseArgsFull()

    // Environment variable should win over CLI option
    expect(result.packageManager).toBe('pnpm')

    // Restore
    require('node:util').parseArgs = originalParseArgs
  })

  test('should fall back to command line option when NPQ_PKG_MGR is not set', () => {
    // Ensure environment variable is not set
    delete process.env.NPQ_PKG_MGR

    jest.resetModules()
    const { CliParser } = require('../lib/cli')

    const originalParseArgs = require('node:util').parseArgs
    require('node:util').parseArgs = jest.fn().mockReturnValue({
      values: { packageManager: 'yarn' },
      positionals: ['install', 'express']
    })

    const result = CliParser.parseArgsFull()

    expect(result.packageManager).toBe('yarn')

    // Restore
    require('node:util').parseArgs = originalParseArgs
  })

  test('should fall back to npm default when neither env var nor CLI option provided', () => {
    delete process.env.NPQ_PKG_MGR

    jest.resetModules()
    const { CliParser } = require('../lib/cli')

    const originalParseArgs = require('node:util').parseArgs
    require('node:util').parseArgs = jest.fn().mockReturnValue({
      values: {}, // No package manager specified
      positionals: ['install', 'express']
    })

    const result = CliParser.parseArgsFull()

    expect(result.packageManager).toBe('npm')

    // Restore
    require('node:util').parseArgs = originalParseArgs
  })

  test('should handle empty NPQ_PKG_MGR environment variable', () => {
    process.env.NPQ_PKG_MGR = '' // Empty string

    jest.resetModules()
    const { CliParser } = require('../lib/cli')

    const originalParseArgs = require('node:util').parseArgs
    require('node:util').parseArgs = jest.fn().mockReturnValue({
      values: { packageManager: 'yarn' },
      positionals: ['install', 'express']
    })

    const result = CliParser.parseArgsFull()

    // Empty string should be falsy, so fall back to CLI option
    expect(result.packageManager).toBe('yarn')

    // Restore
    require('node:util').parseArgs = originalParseArgs
  })
})
