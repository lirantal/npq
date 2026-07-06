'use strict'

const TyposquattingMarshall = require('../lib/marshalls/typosquatting.marshall')

function createTyposquattingMarshall(isPackageInAllowList = false) {
  return new TyposquattingMarshall({
    packageRepoUtils: {
      isPackageInAllowList: jest.fn(() => {
        return isPackageInAllowList
      })
    }
  })
}

describe('Typosquatting Marshall', () => {
  test('should report unique similar packages', async () => {
    const typosquattingMarshall = createTyposquattingMarshall()
    const pkg = {
      packageName: 'eslont'
    }

    try {
      await typosquattingMarshall.validate(pkg)
      // If no error is thrown, the test should fail
      expect(true).toBe(false)
    } catch (error) {
      // Check that the error message doesn't contain duplicate entries
      const errorMessage = error.message
      expect(errorMessage).toContain('Potential typosquatting with popular package(s):')

      // Extract the package names from the error message
      const packagesList = errorMessage.split('popular package(s): ')[1]
      const packages = packagesList.split(', ')

      // Check that there are no duplicates
      const uniquePackages = [...new Set(packages)]
      expect(packages.length).toBe(uniquePackages.length)
      expect(packages).toEqual(expect.arrayContaining(['eslint', 'jslint']))
    }
  })

  test('should not report typosquatting for packages in top packages list', async () => {
    const typosquattingMarshall = createTyposquattingMarshall()

    const pkg = {
      packageName: 'express' // This should be in the top packages list
    }

    const result = await typosquattingMarshall.validate(pkg)
    expect(result).toEqual([])
  })

  test('should not report oxlint as typosquatting', async () => {
    const typosquattingMarshall = createTyposquattingMarshall()

    const pkg = {
      packageName: 'oxlint'
    }

    const result = await typosquattingMarshall.validate(pkg)
    expect(result).toEqual([])
  })

  test('should report typosquatting for close matches to high-impact packages', async () => {
    const typosquattingMarshall = createTyposquattingMarshall()
    const pkg = {
      packageName: 'prettierr'
    }

    await expect(typosquattingMarshall.validate(pkg)).rejects.toThrow(
      'Potential typosquatting with popular package(s): prettier'
    )
  })

  test('should not report typosquatting for packages with no similar matches', async () => {
    const typosquattingMarshall = createTyposquattingMarshall()

    const pkg = {
      packageName: 'verylonganduniquenamethatdoesnotmatchanything'
    }

    const result = await typosquattingMarshall.validate(pkg)
    expect(result).toEqual([])
  })
})
