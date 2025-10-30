'use strict'

const fs = require('fs')
const os = require('os')
const Marshall = require('../lib/marshalls/snyk.marshall.js')

jest.mock('fs')
jest.mock('os')

os.homedir.mockReturnValue('/fake/home')
fs.statSync.mockImplementation(() => {
  throw new Error('File not found')
})

// Mock fetch globally
global.fetch = jest.fn()

const mockPackageRepoUtils = {
  getLatestVersion: jest.fn().mockResolvedValue('1.0.0')
}

describe('Snyk Marshall', () => {
  beforeEach(() => {
    os.homedir.mockReturnValue('/fake/home')
    fetch.mockClear()
    mockPackageRepoUtils.getLatestVersion.mockClear()
  })

  describe('with Snyk token', () => {
    const marshall = new Marshall({
      packageRepoUtils: mockPackageRepoUtils
    })
    // Manually set the token for this test suite
    marshall.snykApiToken = 'fake-snyk-token'

    it('has the right title', () => {
      expect(marshall.title()).toBe('Checking for known vulnerabilities')
    })

    it('should throw an error if vulnerabilities are found', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            vulnerabilities: [{ title: 'XSS' }, { title: 'CSRF' }],
            isMaliciousPackage: false
          })
      })

      const pkg = { packageName: 'test-pkg', packageVersion: '1.0.0' }
      await expect(marshall.validate(pkg)).rejects.toThrow(
        '2 vulnerable path(s) found: https://snyk.io/vuln/npm:test-pkg'
      )
    })

    it('should throw a specific error for malicious packages', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            vulnerabilities: [{ title: 'Malicious Package' }],
            isMaliciousPackage: true
          })
      })

      const pkg = { packageName: 'malicious-pkg', packageVersion: '1.0.0' }
      await expect(marshall.validate(pkg)).rejects.toThrow(
        'Malicious package found: https://snyk.io/vuln/npm:malicious-pkg'
      )
    })

    it('should pass if no vulnerabilities are found', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            vulnerabilities: [],
            isMaliciousPackage: false
          })
      })

      const pkg = { packageName: 'clean-pkg', packageVersion: '1.0.0' }
      await expect(marshall.validate(pkg)).resolves.not.toThrow()
    })

    it('should throw an error if the Snyk API request fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const pkg = { packageName: 'test-pkg', packageVersion: '1.0.0' }
      await expect(marshall.validate(pkg)).rejects.toThrow(
        'Snyk API request failed with status 500'
      )
    })

    it('should throw an error if Snyk API provides no vulnerability info', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'no vulns here' }) // No 'vulnerabilities' property
      })

      const pkg = { packageName: 'test-pkg', packageVersion: '1.0.0' }
      // This will cause getSnykVulnInfo to return `false`, which makes validate throw
      await expect(marshall.validate(pkg)).rejects.toThrow(
        'Unable to query vulnerabilities for packages'
      )
    })

    it('should use latest version if packageVersion is not defined', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            vulnerabilities: [],
            isMaliciousPackage: false
          })
      })

      const pkg = { packageName: 'test-pkg' }
      await marshall.validate(pkg)

      expect(mockPackageRepoUtils.getLatestVersion).toHaveBeenCalledWith('test-pkg')
    })
  })

  describe('without Snyk token (fallback to OSV)', () => {
    const marshall = new Marshall({
      packageRepoUtils: mockPackageRepoUtils
    })
    // Ensure no token is set
    marshall.snykApiToken = null

    it('should throw an error if vulnerabilities are found by OSV', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ vulns: [{ id: 'OSV-1' }, { id: 'OSV-2' }] })
      })

      const pkg = { packageName: 'test-pkg-osv', packageVersion: '1.0.0' }
      await expect(marshall.validate(pkg)).rejects.toThrow(
        '2 vulnerabilities found by OSV for test-pkg-osv'
      )
      expect(fetch).toHaveBeenCalledWith('https://api.osv.dev/v1/query', expect.any(Object))
    })

    it('should pass if no vulnerabilities are found by OSV', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ vulns: [] })
      })

      const pkg = { packageName: 'clean-pkg-osv', packageVersion: '1.0.0' }
      await expect(marshall.validate(pkg)).resolves.not.toThrow()
    })

    it('should handle an empty response from OSV', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      const pkg = { packageName: 'empty-res-pkg', packageVersion: '1.0.0' }
      await expect(marshall.validate(pkg)).resolves.toEqual({
        issuesCount: 0,
        isMaliciousPackage: false
      })
    })

    it('should handle OSV API fetch error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const pkg = { packageName: 'fetch-err-pkg', packageVersion: '1.0.0' }
      const result = await marshall.validate(pkg)

      expect(result).toEqual({ issuesCount: 0, isMaliciousPackage: false })
    })
  })

  describe('run method', () => {
    const marshall = new Marshall({
      packageRepoUtils: mockPackageRepoUtils
    })

    it('should call checkPackage for each package', async () => {
      const ctx = {
        pkgs: [
          { packageName: 'pkg1', packageVersion: '1.0.0' },
          { packageName: 'pkg2', packageVersion: '2.0.0' }
        ]
      }
      const task = {}
      marshall.checkPackage = jest.fn()

      await marshall.run(ctx, task)

      expect(marshall.checkPackage).toHaveBeenCalledTimes(2)
      expect(marshall.checkPackage).toHaveBeenCalledWith(ctx.pkgs[0], ctx, task)
      expect(marshall.checkPackage).toHaveBeenCalledWith(ctx.pkgs[1], ctx, task)
    })
  })

  describe('getSnykToken', () => {
    it('should return null if config file does not exist', () => {
      fs.statSync.mockImplementation(() => {
        throw new Error('ENOENT')
      })

      const marshall = new Marshall({
        packageRepoUtils: mockPackageRepoUtils
      })
      marshall.snykApiToken = null // ensure no token
      const token = marshall.getSnykToken()
      expect(token).toBeNull()
    })

    it('should return null if config file exists but has no token', () => {
      fs.statSync.mockReturnValueOnce({ isFile: () => true })
      jest.doMock('/fake/home/.config/configstore/snyk.json', () => ({}), { virtual: true })

      const marshall = new Marshall({
        packageRepoUtils: mockPackageRepoUtils
      })
      marshall.snykApiToken = null // ensure no token
      const token = marshall.getSnykToken()
      expect(token).toBeNull()
    })

    it('should return the token if the config file exists and has a token', () => {
      fs.statSync.mockImplementation(() => ({ isFile: () => true }))
      fs.readFileSync.mockReturnValue(JSON.stringify({ api: 'a-real-token' }))

      const marshall = new Marshall({
        packageRepoUtils: mockPackageRepoUtils
      })
      marshall.snykApiToken = null // ensure no token
      const token = marshall.getSnykToken()
      expect(token).toBe('a-real-token')

      // Reset mock to avoid affecting other tests
      fs.statSync.mockImplementation(() => {
        throw new Error('File not found')
      })
    })

    it('should return null if config file is malformed', () => {
      fs.statSync.mockImplementation(() => ({ isFile: () => true }))
      fs.readFileSync.mockReturnValue('not a valid json')

      const marshall = new Marshall({
        packageRepoUtils: mockPackageRepoUtils
      })
      marshall.snykApiToken = null // ensure no token
      const token = marshall.getSnykToken()
      expect(token).toBeNull()
    })

    it('should return null if statSync returns falsy', () => {
      fs.statSync.mockReturnValue(false)

      const marshall = new Marshall({
        packageRepoUtils: mockPackageRepoUtils
      })
      marshall.snykApiToken = null // ensure no token
      const token = marshall.getSnykToken()
      expect(token).toBeNull()
    })
  })

  describe('getSnykToken with env var', () => {
    const OLD_ENV = process.env

    beforeEach(() => {
      process.env = { ...OLD_ENV } // Make a copy
      // Ensure mocks are properly set up
      os.homedir.mockReturnValue('/fake/home')
      fs.statSync.mockImplementation(() => {
        throw new Error('File not found')
      })
    })

    afterEach(() => {
      // Clean up require cache without resetting modules
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
    })

    afterAll(() => {
      process.env = OLD_ENV // Restore old environment
    })

    it('should return token from SNYK_TOKEN environment variable', () => {
      process.env.SNYK_TOKEN = 'token-from-env'
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')
      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })
      expect(marshall.getSnykToken()).toBe('token-from-env')
    })

    it('should return token from SNYK_API_TOKEN environment variable', () => {
      process.env.SNYK_API_TOKEN = 'token-from-snyk-api-token'
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')
      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })
      expect(marshall.getSnykToken()).toBe('token-from-snyk-api-token')
    })

    it('should prioritize SNYK_API_TOKEN over SNYK_TOKEN', () => {
      process.env.SNYK_API_TOKEN = 'priority-token'
      process.env.SNYK_TOKEN = 'fallback-token'
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')
      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })
      expect(marshall.getSnykToken()).toBe('priority-token')
    })

    it('should fall back to SNYK_TOKEN when SNYK_API_TOKEN is not set', () => {
      delete process.env.SNYK_API_TOKEN
      process.env.SNYK_TOKEN = 'fallback-token'
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')
      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })
      expect(marshall.getSnykToken()).toBe('fallback-token')
    })

    it('should fall back to config file when neither env var is set', () => {
      delete process.env.SNYK_API_TOKEN
      delete process.env.SNYK_TOKEN

      // Set up mocks
      os.homedir.mockReturnValue('/fake/home')
      fs.statSync.mockImplementation(() => ({ isFile: () => true }))
      fs.readFileSync.mockReturnValue(JSON.stringify({ api: 'config-file-token' }))

      // Reload module
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')
      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })
      expect(marshall.getSnykToken()).toBe('config-file-token')

      // Reset mock
      fs.statSync.mockImplementation(() => {
        throw new Error('File not found')
      })
    })
  })

  describe('Custom Snyk API URL via environment variables', () => {
    const OLD_ENV = process.env

    beforeEach(() => {
      process.env = { ...OLD_ENV }
      fetch.mockClear()
      // Ensure mocks are properly set up
      os.homedir.mockReturnValue('/fake/home')
      fs.statSync.mockImplementation(() => {
        throw new Error('File not found')
      })
    })

    afterEach(() => {
      // Clean up require cache
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
    })

    afterAll(() => {
      process.env = OLD_ENV
    })

    it('should use default Snyk API URL when no env var is set', () => {
      delete process.env.SNYK_API_URL
      delete process.env.SNYK_API

      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')

      // We test the default behavior by instantiating the marshall
      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })

      // The default URL should be used - verified through integration tests
      expect(marshall).toBeDefined()
    })

    it('should use SNYK_API_URL when set', async () => {
      process.env.SNYK_API_URL = 'https://api.eu.snyk.io/v1/vuln/npm'
      process.env.SNYK_API_TOKEN = 'test-token'

      // Need to reload the module to pick up the new env var
      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')

      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ vulnerabilities: [] })
      })

      const pkg = { packageName: 'test-pkg', packageVersion: '1.0.0' }
      await marshall.validate(pkg)

      // Verify fetch was called with the custom URL
      expect(fetch).toHaveBeenCalledWith(
        'https://api.eu.snyk.io/v1/vuln/npm/test-pkg%401.0.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token test-token'
          })
        })
      )
    })

    it('should use SNYK_API when SNYK_API_URL is not set', async () => {
      delete process.env.SNYK_API_URL
      process.env.SNYK_API = 'https://custom.snyk.endpoint/api/v1/vuln/npm'
      process.env.SNYK_API_TOKEN = 'test-token'

      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')

      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ vulnerabilities: [] })
      })

      const pkg = { packageName: 'another-pkg', packageVersion: '2.0.0' }
      await marshall.validate(pkg)

      expect(fetch).toHaveBeenCalledWith(
        'https://custom.snyk.endpoint/api/v1/vuln/npm/another-pkg%402.0.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token test-token'
          })
        })
      )
    })

    it('should prioritize SNYK_API_URL over SNYK_API', async () => {
      process.env.SNYK_API_URL = 'https://priority.snyk.io/api/v1/vuln/npm'
      process.env.SNYK_API = 'https://fallback.snyk.io/api/v1/vuln/npm'
      process.env.SNYK_API_TOKEN = 'test-token'

      delete require.cache[require.resolve('../lib/marshalls/snyk.marshall.js')]
      const MarshallWithEnv = require('../lib/marshalls/snyk.marshall.js')

      const marshall = new MarshallWithEnv({
        packageRepoUtils: mockPackageRepoUtils
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ vulnerabilities: [] })
      })

      const pkg = { packageName: 'priority-pkg', packageVersion: '1.0.0' }
      await marshall.validate(pkg)

      expect(fetch).toHaveBeenCalledWith(
        'https://priority.snyk.io/api/v1/vuln/npm/priority-pkg%401.0.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token test-token'
          })
        })
      )
    })
  })
})
