// Mock environment variables for testing
const originalEnv = process.env
const originalIsTTY = process.stdout.isTTY

beforeEach(() => {
  jest.resetModules()
  process.env = { ...originalEnv }
  // Clear any CI environment variables to ensure clean state
  const ciVars = [
    'CI',
    'CONTINUOUS_INTEGRATION',
    'BUILD_NUMBER',
    'RUN_ID',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'TRAVIS',
    'CIRCLECI',
    'JENKINS_URL',
    'TEAMCITY_VERSION',
    'TF_BUILD',
    'BUILDKITE',
    'DRONE'
  ]
  ciVars.forEach((envVar) => {
    delete process.env[envVar]
  })
})

afterEach(() => {
  process.env = originalEnv
  process.stdout.isTTY = originalIsTTY
})

describe('cliSupportHandler', () => {
  describe('isInteractiveTerminal', () => {
    test('should return false when CI environment variable is set', () => {
      process.env.CI = 'true'
      // Ensure TTY is set to true so we're testing CI detection specifically
      process.stdout.isTTY = true

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()
      expect(result).toBe(false)
    })

    test('should return false when GITHUB_ACTIONS environment variable is set', () => {
      process.env.GITHUB_ACTIONS = 'true'
      // Ensure TTY is set to true so we're testing CI detection specifically
      process.stdout.isTTY = true

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()
      expect(result).toBe(false)
    })

    test('should return false when GITLAB_CI environment variable is set', () => {
      process.env.GITLAB_CI = 'true'
      // Ensure TTY is set to true so we're testing CI detection specifically
      process.stdout.isTTY = true

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()
      expect(result).toBe(false)
    })

    test('should return false when TRAVIS environment variable is set', () => {
      process.env.TRAVIS = 'true'
      // Ensure TTY is set to true so we're testing CI detection specifically
      process.stdout.isTTY = true

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()
      expect(result).toBe(false)
    })

    test('should return false when CIRCLECI environment variable is set', () => {
      process.env.CIRCLECI = 'true'
      // Ensure TTY is set to true so we're testing CI detection specifically
      process.stdout.isTTY = true

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()
      expect(result).toBe(false)
    })

    test('should return false when multiple CI environment variables are set', () => {
      process.env.CI = 'true'
      process.env.TRAVIS = 'true'
      process.env.CIRCLECI = 'true'
      // Ensure TTY is set to true so we're testing CI detection specifically
      process.stdout.isTTY = true

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()
      expect(result).toBe(false)
    })

    test('should return true when no CI environment variables are set and stdout is TTY', () => {
      // Clear all CI environment variables
      delete process.env.CI
      delete process.env.GITHUB_ACTIONS
      delete process.env.GITLAB_CI
      delete process.env.TRAVIS
      delete process.env.CIRCLECI
      delete process.env.JENKINS_URL
      delete process.env.BUILDKITE
      delete process.env.DRONE

      // Mock process.stdout.isTTY to return true
      const originalIsTTY = process.stdout.isTTY
      process.stdout.isTTY = true

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()

      // Restore original value
      process.stdout.isTTY = originalIsTTY

      expect(result).toBe(true)
    })

    test('should return false when stdout is not TTY even without CI variables', () => {
      // Clear all CI environment variables
      delete process.env.CI
      delete process.env.GITHUB_ACTIONS
      delete process.env.GITLAB_CI
      delete process.env.TRAVIS
      delete process.env.CIRCLECI
      delete process.env.JENKINS_URL
      delete process.env.BUILDKITE
      delete process.env.DRONE

      // Mock process.stdout.isTTY to return false
      const originalIsTTY = process.stdout.isTTY
      process.stdout.isTTY = false

      const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')
      const result = isInteractiveTerminal()

      // Restore original value
      process.stdout.isTTY = originalIsTTY

      expect(result).toBe(false)
    })
  })
})

describe('reportResults', () => {
  const mockMarshallResults = {
    'test-package@1.0.0': [
      {
        'supply-chain-security': {
          marshall: 'supply-chain-security',
          categoryId: 'SupplyChainSecurity',
          errors: [
            { message: 'Package has suspicious activity in recent versions' },
            { message: 'Maintainer account shows signs of compromise' }
          ],
          warnings: [{ message: 'Package lacks proper security documentation' }]
        }
      }
    ],
    'another-package@2.1.0': [
      {
        'package-health': {
          marshall: 'package-health',
          categoryId: 'PackageHealth',
          errors: [],
          warnings: [
            { message: 'Package has not been updated in over 2 years' },
            { message: 'Dependencies are outdated' }
          ]
        }
      }
    ]
  }

  beforeEach(() => {
    // Clear CI environment variables for consistent testing
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI
    delete process.env.TRAVIS
    delete process.env.CIRCLECI
    delete process.env.JENKINS_URL
    delete process.env.BUILDKITE
    delete process.env.DRONE
  })

  test('should return undefined for empty results', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults({})
    expect(result).toBeUndefined()
  })

  test('should return undefined for null results', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(null)
    expect(result).toBeUndefined()
  })

  test('should generate both rich and plain text formats', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    expect(result).toBeDefined()
    expect(result.resultsForPrettyPrint).toBeDefined()
    expect(result.resultsForPlainTextPrint).toBeDefined()
    expect(result.summaryForPrettyPrint).toBeDefined()
    expect(result.summaryForPlainTextPrint).toBeDefined()

    // Both formats should have content
    expect(result.resultsForPrettyPrint.length).toBeGreaterThan(0)
    expect(result.resultsForPlainTextPrint.length).toBeGreaterThan(0)
    expect(result.summaryForPrettyPrint.length).toBeGreaterThan(0)
    expect(result.summaryForPlainTextPrint.length).toBeGreaterThan(0)
  })

  test('should count errors and warnings correctly', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    expect(result.countErrors).toBe(2) // 2 errors from test-package
    expect(result.countWarnings).toBe(3) // 1 warning from test-package + 2 from another-package
  })

  test('should set useRichFormatting to false in CI mode', () => {
    process.env.CI = 'true'
    // Ensure TTY is set to true so we're testing CI detection specifically
    process.stdout.isTTY = true

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    expect(result.useRichFormatting).toBe(false)
  })

  test('should set useRichFormatting to true in interactive mode', () => {
    // Clear CI environment variables
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI
    delete process.env.TRAVIS
    delete process.env.CIRCLECI
    delete process.env.JENKINS_URL
    delete process.env.BUILDKITE
    delete process.env.DRONE

    // Mock process.stdout.isTTY
    const originalIsTTY = process.stdout.isTTY
    process.stdout.isTTY = true

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    // Restore original value
    process.stdout.isTTY = originalIsTTY

    expect(result.useRichFormatting).toBe(true)
  })

  test('should include package names in plain text format', () => {
    process.env.CI = 'true'
    // Ensure TTY is set to true so we're testing CI detection specifically
    process.stdout.isTTY = true

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    expect(result.resultsForPlainTextPrint).toContain('test-package@1.0.0')
    expect(result.resultsForPlainTextPrint).toContain('another-package@2.1.0')
  })

  test('should include error and warning labels in plain text format', () => {
    process.env.CI = 'true'
    // Ensure TTY is set to true so we're testing CI detection specifically
    process.stdout.isTTY = true

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    expect(result.resultsForPlainTextPrint).toContain('ERROR:')
    expect(result.resultsForPlainTextPrint).toContain('WARNING:')
  })

  test('should include category names in both formats', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    // Rich format should contain category names
    expect(result.resultsForPrettyPrint).toContain('Supply Chain Security')
    expect(result.resultsForPrettyPrint).toContain('Package Health')

    // Plain text format should also contain category names
    expect(result.resultsForPlainTextPrint).toContain('Supply Chain Security')
    expect(result.resultsForPlainTextPrint).toContain('Package Health')
  })

  test('should include error and warning messages in both formats', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    const expectedMessages = [
      // NOTE: the first message is cut at the end to not include "versions" as part of the text
      // because it gets cut due to the 80 chars default limit of output to the terminal
      // and fails the test for exact string match
      'Package has suspicious activity in recent',
      'Maintainer account shows signs of compromise',
      'Package lacks proper security documentation',
      'Package has not been updated in over 2 years',
      'Dependencies are outdated'
    ]

    expectedMessages.forEach((message) => {
      expect(result.resultsForPrettyPrint).toContain(message)
      expect(result.resultsForPlainTextPrint).toContain(message)
    })
  })

  test('should include summary statistics in both formats', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    // Check rich format summary
    expect(result.summaryForPrettyPrint).toContain('Summary:')
    expect(result.summaryForPrettyPrint).toContain('Total packages:')
    expect(result.summaryForPrettyPrint).toContain('2')
    expect(result.summaryForPrettyPrint).toContain('Total errors:')
    expect(result.summaryForPrettyPrint).toContain('Total warnings:')
    expect(result.summaryForPrettyPrint).toContain('3')

    // Check plain text format summary
    expect(result.summaryForPlainTextPrint).toContain('Summary:')
    expect(result.summaryForPlainTextPrint).toContain('Total packages: 2')
    expect(result.summaryForPlainTextPrint).toContain('Total errors: 2')
    expect(result.summaryForPlainTextPrint).toContain('Total warnings: 3')
  })

  test('should return all required properties', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    const expectedProperties = [
      'countErrors',
      'countWarnings',
      'resultsForPrettyPrint',
      'resultsForJSON',
      'resultsForPlainTextPrint',
      'summaryForPrettyPrint',
      'summaryForPlainTextPrint',
      'useRichFormatting'
    ]

    expectedProperties.forEach((prop) => {
      expect(result).toHaveProperty(prop)
    })
  })

  test('should include JSON format with original data structure', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults)

    expect(result.resultsForJSON).toBeDefined()
    expect(Array.isArray(result.resultsForJSON)).toBe(true)
    expect(result.resultsForJSON.length).toBe(2) // Two packages

    // Check that JSON format contains expected package data
    const packageNames = result.resultsForJSON.map((pkg) => pkg.pkg)
    expect(packageNames).toContain('test-package@1.0.0')
    expect(packageNames).toContain('another-package@2.1.0')
  })
})

describe('basic functionality test', () => {
  test('functions can be imported', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

    expect(typeof reportResults).toBe('function')
    expect(typeof isInteractiveTerminal).toBe('function')
  })
})
