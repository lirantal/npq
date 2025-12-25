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
