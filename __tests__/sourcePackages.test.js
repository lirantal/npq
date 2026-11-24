'use strict'

jest.mock('node:fs/promises')

const fs = require('node:fs/promises')
const { getProjectPackages } = require('../lib/helpers/sourcePackages')

describe('sourcePackages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getProjectPackages', () => {
    it('should return a flat array when both dependencies and devDependencies exist', async () => {
      const mockPackageJson = {
        name: 'test-project',
        dependencies: {
          express: '^4.18.0',
          lodash: '^4.17.21'
        },
        devDependencies: {
          jest: '^29.0.0',
          eslint: '^8.0.0'
        }
      }

      fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson))

      const packages = await getProjectPackages()

      // Verify result is a flat array (regression test for spread operator fix)
      expect(Array.isArray(packages)).toBe(true)
      expect(packages.every((pkg) => typeof pkg === 'string')).toBe(true)

      // Verify all packages are present with correct format
      expect(packages).toHaveLength(4)
      expect(packages).toEqual([
        'express@^4.18.0',
        'lodash@^4.17.21',
        'jest@^29.0.0',
        'eslint@^8.0.0'
      ])
    })

    it('should return only dependencies when devDependencies is missing', async () => {
      const mockPackageJson = {
        name: 'test-project',
        dependencies: {
          express: '^4.18.0',
          lodash: '^4.17.21'
        }
      }

      fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson))

      const packages = await getProjectPackages()

      expect(Array.isArray(packages)).toBe(true)
      expect(packages.every((pkg) => typeof pkg === 'string')).toBe(true)
      expect(packages).toHaveLength(2)
      expect(packages).toEqual(['express@^4.18.0', 'lodash@^4.17.21'])
    })

    it('should return only devDependencies when dependencies is missing', async () => {
      const mockPackageJson = {
        name: 'test-project',
        devDependencies: {
          jest: '^29.0.0',
          eslint: '^8.0.0'
        }
      }

      fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson))

      const packages = await getProjectPackages()

      expect(Array.isArray(packages)).toBe(true)
      expect(packages.every((pkg) => typeof pkg === 'string')).toBe(true)
      expect(packages).toHaveLength(2)
      expect(packages).toEqual(['jest@^29.0.0', 'eslint@^8.0.0'])
    })

    it('should return empty array when neither dependencies nor devDependencies exist', async () => {
      const mockPackageJson = {
        name: 'test-project',
        version: '1.0.0'
      }

      fs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson))

      const packages = await getProjectPackages()

      expect(Array.isArray(packages)).toBe(true)
      expect(packages).toHaveLength(0)
      expect(packages).toEqual([])
    })

    test.each(['dependencies', 'devDependencies'])(
      'rejects unsupported or non-string values in %s without returning partial packages',
      async (section) => {
        for (const spec of [
          'github:user/repo',
          'user/repo',
          'git+https://example.test/x.git',
          'https://example.test/x.tgz',
          'file:./local',
          '../local',
          './local.tgz',
          'npm:target@1.2.3',
          null,
          123,
          {},
          []
        ]) {
          fs.readFile.mockResolvedValue(
            JSON.stringify({
              [section]: { valid: '^1.0.0', unsupported: spec }
            })
          )
          await expect(getProjectPackages()).resolves.toEqual({
            error: true,
            code: 'EUNSUPPORTEDPACKAGESPEC',
            message: expect.stringContaining(`package.json ${section}, entry 2`)
          })
        }
      }
    )

    describe.each(['dependencies', 'devDependencies'])('%s shape validation', (section) => {
      test.each([[], ['express'], 'express', true, false, 1, 0, null])(
        'rejects a non-object section: %j',
        async (value) => {
          fs.readFile.mockResolvedValue(JSON.stringify({ [section]: value }))
          const result = await getProjectPackages()
          expect(result.error).toBe(true)
          expect(result.message).toContain(`Invalid package.json ${section}`)
          expect(result.message).toContain('expected an object')
        }
      )

      test('accepts an empty dependency map', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify({ [section]: {} }))
        await expect(getProjectPackages()).resolves.toEqual([])
      })
    })

    test('identifies a rejected dependency without repeating its specifier', async () => {
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            express: '*',
            '@scope/unsafe': 'https://user:credential@example.test/private.tgz'
          }
        })
      )
      const result = await getProjectPackages()
      expect(result.message).toContain('"@scope/unsafe"')
      expect(result.message).toContain('package.json dependencies, entry 2')
      expect(result.message).not.toContain('credential')
      expect(result.message).not.toContain('private.tgz')
    })

    test('does not echo an invalid dependency key', async () => {
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: { 'https://user:credential@example.test/private.tgz': 'npm:target@1' }
        })
      )
      const result = await getProjectPackages()
      expect(result.error).toBe(true)
      expect(result.message).toContain('package.json dependencies, entry 1')
      expect(result.message).not.toContain('credential')
    })

    test('preserves scoped registry dependencies, tags, and wildcard ranges', async () => {
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: { '@scope/tool': '^1.2.0', tagged: 'next', wildcard: '*' }
        })
      )
      await expect(getProjectPackages()).resolves.toEqual([
        '@scope/tool@^1.2.0',
        'tagged@next',
        'wildcard@*'
      ])
    })

    it('should return error object when package.json is not found', async () => {
      const error = new Error('File not found')
      error.code = 'ENOENT'
      fs.readFile.mockRejectedValue(error)

      const result = await getProjectPackages()

      expect(result).toEqual({
        error: true,
        message: expect.stringContaining('No package.json found')
      })
    })

    it('should return error object when package.json contains invalid JSON', async () => {
      fs.readFile.mockResolvedValue('{ invalid json }')

      const result = await getProjectPackages()

      expect(result).toEqual({
        error: true,
        message: expect.stringContaining('Error reading package.json')
      })
    })

    it('should return error object for other file read errors', async () => {
      const error = new Error('Permission denied')
      error.code = 'EACCES'
      fs.readFile.mockRejectedValue(error)

      const result = await getProjectPackages()

      expect(result).toEqual({
        error: true,
        message: expect.stringContaining('Error reading package.json')
      })
    })
  })
})
