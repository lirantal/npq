// __tests__/env-var-integration.test.js

'use strict'

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

  test('should prioritize NPQ_PKG_MGR environment variable over command line options', () => {
    // This test verifies the core functionality:
    // process.env.NPQ_PKG_MGR || values.packageManager || values.pkgMgr || 'npm'

    process.env.NPQ_PKG_MGR = 'pnpm'

    jest.resetModules()
    const util = require('node:util')
    const originalParseArgs = util.parseArgs
    util.parseArgs = jest.fn().mockReturnValue({
      values: { packageManager: 'yarn' },
      positionals: ['install', 'express']
    })

    const { CliParser } = require('../lib/cli')
    const result = CliParser.parseArgsFull()

    expect(result.packageManager).toBe('pnpm')

    util.parseArgs = originalParseArgs
  })

  test('should fall back to command line option when NPQ_PKG_MGR is not set', () => {
    delete process.env.NPQ_PKG_MGR

    jest.resetModules()
    const util = require('node:util')
    const originalParseArgs = util.parseArgs
    util.parseArgs = jest.fn().mockReturnValue({
      values: { packageManager: 'yarn' },
      positionals: ['install', 'express']
    })

    const { CliParser } = require('../lib/cli')
    const result = CliParser.parseArgsFull()

    expect(result.packageManager).toBe('yarn')

    util.parseArgs = originalParseArgs
  })

  test('should fall back to npm default when neither env var nor CLI option provided', () => {
    delete process.env.NPQ_PKG_MGR

    jest.resetModules()
    const util = require('node:util')
    const originalParseArgs = util.parseArgs
    util.parseArgs = jest.fn().mockReturnValue({
      values: {},
      positionals: ['install', 'express']
    })

    const { CliParser } = require('../lib/cli')
    const result = CliParser.parseArgsFull()

    expect(result.packageManager).toBe('npm')

    util.parseArgs = originalParseArgs
  })

  test('should handle empty NPQ_PKG_MGR environment variable', () => {
    process.env.NPQ_PKG_MGR = ''

    jest.resetModules()
    const util = require('node:util')
    const originalParseArgs = util.parseArgs
    util.parseArgs = jest.fn().mockReturnValue({
      values: { packageManager: 'yarn' },
      positionals: ['install', 'express']
    })

    const { CliParser } = require('../lib/cli')
    const result = CliParser.parseArgsFull()

    expect(result.packageManager).toBe('yarn')

    util.parseArgs = originalParseArgs
  })
})
