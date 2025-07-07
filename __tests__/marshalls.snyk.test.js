'use strict'

const Marshall = require('../lib/marshalls/snyk.marshall.js')
const { marshallCategories } = require('../lib/marshalls/constants')

// Mock fetch globally
global.fetch = jest.fn()

const mockPackageRepoUtils = {
  getLatestVersion: jest.fn().mockResolvedValue('1.0.0')
}

describe('Snyk Marshall', () => {
  beforeEach(() => {
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
  })
})
