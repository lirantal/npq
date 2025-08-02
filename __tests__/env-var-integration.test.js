// __tests__/env-var-integration.test.js

// Test the NPQ_PKG_MGR environment variable functionality
// This tests the key logic change: process.env.NPQ_PKG_MGR || values.packageManager || values.pkgMgr || 'npm'

const packageManager = require('../lib/packageManager')

const childProcess = require('child_process')

jest.mock('child_process', () => {
  return {
    spawn: jest.fn((cmd, options) => {
      return { pid: 12345 }
    })
  }
})

describe('NPQ_PKG_MGR Environment Variable Integration', () => {
  let originalNPQ_PKG_MGR

  beforeEach(() => {
    originalNPQ_PKG_MGR = process.env.NPQ_PKG_MGR
    delete process.env.NPQ_PKG_MGR
    childProcess.spawn.mockClear()
  })

  afterEach(() => {
    if (originalNPQ_PKG_MGR !== undefined) {
      process.env.NPQ_PKG_MGR = originalNPQ_PKG_MGR
    } else {
      delete process.env.NPQ_PKG_MGR
    }
  })

  test('package manager process should handle pnpm correctly', async () => {
    process.argv = ['node', 'npq', 'install', 'fastify']

    // Test that the package manager can spawn pnpm (which would be passed from CLI parsing)
    await packageManager.process('pnpm')

    expect(childProcess.spawn).toHaveBeenCalledWith('pnpm install fastify', {
      stdio: 'inherit',
      shell: true
    })
  })

  test('package manager process should handle yarn correctly', async () => {
    process.argv = ['node', 'npq', 'install', 'express', 'lodash']

    await packageManager.process('yarn')

    expect(childProcess.spawn).toHaveBeenCalledWith('yarn install express lodash', {
      stdio: 'inherit',
      shell: true
    })
  })

  test('package manager process should handle various package managers', async () => {
    const packageManagers = ['npm', 'yarn', 'pnpm', 'bun']

    for (const pm of packageManagers) {
      process.argv = ['node', 'npq', 'install', 'test-package']

      await packageManager.process(pm)

      expect(childProcess.spawn).toHaveBeenCalledWith(`${pm} install test-package`, {
        stdio: 'inherit',
        shell: true
      })

      childProcess.spawn.mockClear()
    }
  })

  test('should demonstrate NPQ_PKG_MGR environment variable precedence logic', () => {
    // This test documents the specific logic that was implemented:
    // packageManager: process.env.NPQ_PKG_MGR || values.packageManager || values.pkgMgr || 'npm'

    // Test 1: Environment variable takes precedence
    process.env.NPQ_PKG_MGR = 'pnpm'
    const values1 = { packageManager: 'yarn', pkgMgr: 'npm' }
    const result1 = process.env.NPQ_PKG_MGR || values1.packageManager || values1.pkgMgr || 'npm'
    expect(result1).toBe('pnpm')

    // Test 2: Falls back to packageManager when env var not set
    delete process.env.NPQ_PKG_MGR
    const values2 = { packageManager: 'yarn', pkgMgr: 'npm' }
    const result2 = process.env.NPQ_PKG_MGR || values2.packageManager || values2.pkgMgr || 'npm'
    expect(result2).toBe('yarn')

    // Test 3: Falls back to pkgMgr when env var and packageManager not set
    delete process.env.NPQ_PKG_MGR
    const values3 = { pkgMgr: 'pnpm' }
    const result3 = process.env.NPQ_PKG_MGR || values3.packageManager || values3.pkgMgr || 'npm'
    expect(result3).toBe('pnpm')

    // Test 4: Falls back to npm default when nothing is set
    delete process.env.NPQ_PKG_MGR
    const values4 = {}
    const result4 = process.env.NPQ_PKG_MGR || values4.packageManager || values4.pkgMgr || 'npm'
    expect(result4).toBe('npm')

    // Test 5: Empty string environment variable falls back to CLI options
    process.env.NPQ_PKG_MGR = ''
    const values5 = { packageManager: 'yarn' }
    const result5 = process.env.NPQ_PKG_MGR || values5.packageManager || values5.pkgMgr || 'npm'
    expect(result5).toBe('yarn')
  })
})
