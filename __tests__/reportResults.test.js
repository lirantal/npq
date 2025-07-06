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

  describe('isEnvSupport', () => {
    test('should return true for Node.js >= 20.13.0', () => {
      // Mock semver.satisfies to return true for supported version
      const semver = require('semver')
      jest.spyOn(semver, 'satisfies').mockReturnValue(true)

      jest.resetModules()
      const { isEnvSupport } = require('../lib/helpers/cliSupportHandler')

      const result = isEnvSupport()
      expect(result).toBe(true)

      semver.satisfies.mockRestore()
    })

    test('should return false for Node.js < 20.13.0', () => {
      // Mock semver.satisfies to return false for unsupported version
      const semver = require('semver')
      const mockSatisfies = jest.spyOn(semver, 'satisfies').mockReturnValue(false)

      const { isEnvSupport } = require('../lib/helpers/cliSupportHandler')

      const result = isEnvSupport()
      expect(result).toBe(false)

      mockSatisfies.mockRestore()
    })

    test('should return true for Node.js > 20.13.0', () => {
      // Mock semver.satisfies to return true for newer supported version
      const semver = require('semver')
      jest.spyOn(semver, 'satisfies').mockReturnValue(true)

      jest.resetModules()
      const { isEnvSupport } = require('../lib/helpers/cliSupportHandler')

      const result = isEnvSupport()
      expect(result).toBe(true)

      semver.satisfies.mockRestore()
    })
  })

  describe('noSupportError', () => {
    let consoleSpy

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    test('should output styled error message in interactive terminal', () => {
      // Set up interactive terminal
      process.stdout.isTTY = true

      const { noSupportError } = require('../lib/helpers/cliSupportHandler')
      const result = noSupportError(false)

      expect(result).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/error:/),
        'npq suppressed due to old node version'
      )
    })

    test('should output plain error message in non-interactive terminal', () => {
      // Set up non-interactive terminal
      process.stdout.isTTY = false

      const { noSupportError } = require('../lib/helpers/cliSupportHandler')
      const result = noSupportError(false)

      expect(result).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith('error: npq suppressed due to old node version')
    })

    test('should call process.exit when failFast is true', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})
      process.stdout.isTTY = true

      const { noSupportError } = require('../lib/helpers/cliSupportHandler')
      noSupportError(true)

      expect(mockExit).toHaveBeenCalledWith(-1)
      mockExit.mockRestore()
    })

    test('should not call process.exit when failFast is false', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})
      process.stdout.isTTY = true

      const { noSupportError } = require('../lib/helpers/cliSupportHandler')
      const result = noSupportError(false)

      expect(result).toBe(true)
      expect(mockExit).not.toHaveBeenCalled()
      mockExit.mockRestore()
    })
  })

  describe('packageManagerPassthrough', () => {
    test('should spawn package manager with correct arguments and exit with status', () => {
      const mockSpawnSync = jest.fn().mockReturnValue({ status: 0 })
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})

      // Mock child_process
      jest.doMock('child_process', () => ({
        spawnSync: mockSpawnSync
      }))

      // Mock process.argv
      const originalArgv = process.argv
      process.argv = ['node', 'npq', 'install', 'package-name']

      const { packageManagerPassthrough } = require('../lib/helpers/cliSupportHandler')
      packageManagerPassthrough()

      expect(mockSpawnSync).toHaveBeenCalledWith('npm', ['install', 'package-name'], {
        stdio: 'inherit',
        shell: true
      })
      expect(mockExit).toHaveBeenCalledWith(0)

      // Restore mocks
      process.argv = originalArgv
      mockExit.mockRestore()
      jest.dontMock('child_process')
    })

    test('should exit with error status when spawn fails', () => {
      const mockSpawnSync = jest.fn().mockReturnValue({ status: 1 })
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})

      // Mock child_process
      jest.doMock('child_process', () => ({
        spawnSync: mockSpawnSync
      }))

      const originalArgv = process.argv
      process.argv = ['node', 'npq', 'install', 'package-name']

      const { packageManagerPassthrough } = require('../lib/helpers/cliSupportHandler')
      packageManagerPassthrough()

      expect(mockExit).toHaveBeenCalledWith(1)

      // Restore mocks
      process.argv = originalArgv
      mockExit.mockRestore()
      jest.dontMock('child_process')
    })

    test('should use custom package manager from environment variable', () => {
      const mockSpawnSync = jest.fn().mockReturnValue({ status: 0 })
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})

      // Set custom package manager
      process.env.NPQ_PKG_MGR = 'yarn'

      // Mock child_process
      jest.doMock('child_process', () => ({
        spawnSync: mockSpawnSync
      }))

      const originalArgv = process.argv
      process.argv = ['node', 'npq', 'add', 'package-name']

      const { packageManagerPassthrough } = require('../lib/helpers/cliSupportHandler')
      packageManagerPassthrough()

      expect(mockSpawnSync).toHaveBeenCalledWith('yarn', ['add', 'package-name'], {
        stdio: 'inherit',
        shell: true
      })

      // Restore mocks and env
      delete process.env.NPQ_PKG_MGR
      process.argv = originalArgv
      mockExit.mockRestore()
      jest.dontMock('child_process')
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

  test('should set useRichFormatting to false when plain option is true', () => {
    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(mockMarshallResults, { plain: true })

    expect(result.useRichFormatting).toBe(false)
  })
})

describe('reportResults helper functions', () => {
  test('should handle getTerminalWidth error cases', () => {
    // First define getWindowSize if it doesn't exist
    const originalGetWindowSize = process.stdout.getWindowSize
    if (!originalGetWindowSize) {
      process.stdout.getWindowSize = () => [80]
    }

    // Use jest.spyOn to mock getWindowSize
    const mockGetWindowSize = jest.spyOn(process.stdout, 'getWindowSize')
    mockGetWindowSize.mockImplementation(() => {
      throw new Error('Terminal size detection failed')
    })

    process.stdout.isTTY = true

    const testResults = {
      'test-package@1.0.0': [
        {
          'supply-chain-security': {
            categoryId: 'SupplyChainSecurity',
            marshall: 'supply-chain-security',
            errors: [{ message: 'Test error', pkg: 'test-package@1.0.0' }],
            warnings: []
          }
        }
      ]
    }

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(testResults)
    expect(result).toBeDefined()
    expect(result.useRichFormatting).toBeDefined()

    mockGetWindowSize.mockRestore()

    // Restore original if it existed, or delete if we added it
    if (originalGetWindowSize) {
      process.stdout.getWindowSize = originalGetWindowSize
    } else {
      delete process.stdout.getWindowSize
    }
  })

  test('should handle stdout without getWindowSize method', () => {
    // Mock process.stdout.isTTY to true but don't define getWindowSize
    const originalGetWindowSize = process.stdout.getWindowSize
    delete process.stdout.getWindowSize
    process.stdout.isTTY = true

    const testResults = {
      'test-package@1.0.0': [
        {
          'package-health': {
            categoryId: 'PackageHealth',
            marshall: 'package-health',
            errors: [{ message: 'Test error', pkg: 'test-package@1.0.0' }],
            warnings: []
          }
        }
      ]
    }

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(testResults)
    expect(result).toBeDefined()

    // Restore original getWindowSize
    if (originalGetWindowSize) {
      process.stdout.getWindowSize = originalGetWindowSize
    }
  })

  test('should handle text wrapping for very long words', () => {
    // First define getWindowSize if it doesn't exist
    const originalGetWindowSize = process.stdout.getWindowSize
    if (!originalGetWindowSize) {
      process.stdout.getWindowSize = () => [80]
    }

    // Mock getWindowSize to return small width
    const mockGetWindowSize = jest.spyOn(process.stdout, 'getWindowSize')
    mockGetWindowSize.mockReturnValue([40])

    process.stdout.isTTY = true

    const testResults = {
      'test-package@1.0.0': [
        {
          'malware-detection': {
            categoryId: 'MalwareDetection',
            marshall: 'malware-detection',
            errors: [
              {
                message:
                  'This-is-a-very-long-word-that-should-be-broken-when-wrapping-text-because-it-exceeds-terminal-width',
                pkg: 'test-package@1.0.0'
              }
            ],
            warnings: []
          }
        }
      ]
    }

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(testResults)
    expect(result).toBeDefined()
    expect(result.resultsForPrettyPrint).toContain('This-is-a-very-long-word')

    mockGetWindowSize.mockRestore()

    // Restore original if it existed, or delete if we added it
    if (originalGetWindowSize) {
      process.stdout.getWindowSize = originalGetWindowSize
    } else {
      delete process.stdout.getWindowSize
    }
  })

  test('should handle text wrapping edge cases', () => {
    process.stdout.isTTY = true

    const testResults = {
      'test-package@1.0.0': [
        {
          'supply-chain-security': {
            categoryId: 'SupplyChainSecurity',
            marshall: 'supply-chain-security',
            errors: [
              {
                message: 'Word',
                pkg: 'test-package@1.0.0'
              }
            ],
            warnings: []
          }
        }
      ]
    }

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(testResults)
    expect(result).toBeDefined()
    expect(result.resultsForPrettyPrint).toContain('Word')
  })

  test('should handle malicious package detection edge cases', () => {
    process.stdout.isTTY = true

    const testResults = {
      'test-package@1.0.0': [
        {
          'malware-detection': {
            categoryId: 'MalwareDetection',
            marshall: 'malware-detection',
            errors: [{ message: 'Malicious package found in registry', pkg: 'test-package@1.0.0' }],
            warnings: []
          }
        }
      ]
    }

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(testResults)
    expect(result).toBeDefined()
    expect(result.countErrors).toBe(1) // Should be 1 for malicious packages
    expect(result.resultsForPrettyPrint).toContain('Malicious package found')
  })

  test('should handle multiple error arrays with malicious package in later array', () => {
    process.stdout.isTTY = true

    const testResults = {
      'test-package@1.0.0': [
        {
          'malware-detection': {
            categoryId: 'MalwareDetection',
            marshall: 'malware-detection',
            errors: [
              { message: 'Regular error 1', pkg: 'test-package@1.0.0' },
              { message: 'Malicious package found', pkg: 'test-package@1.0.0' }
            ],
            warnings: []
          }
        }
      ]
    }

    const { reportResults } = require('../lib/helpers/reportResults')
    const result = reportResults(testResults)
    expect(result).toBeDefined()
    expect(result.countErrors).toBe(1) // Malicious packages count as 1 error regardless of count
    expect(result.resultsForPrettyPrint).toContain('Malicious package found')
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
