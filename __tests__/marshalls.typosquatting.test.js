const TyposquattingMarshall = require('../lib/marshalls/typosquatting.marshall')

describe('Typosquatting Marshall', () => {
  test('should remove duplicate entries from similar packages', async () => {
    const typosquattingMarshall = new TyposquattingMarshall({
      packageRepoUtils: {
        isPackageInAllowList: jest.fn(() => {
          return false // Simulate that the package is not in the allow list
        })
      }
    })

    // Create a test package that would match multiple similar packages
    const pkg = {
      packageName: 'ghtml' // This should match 'html' which appears multiple times in the data
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

      // Verify that 'html' appears only once even though it exists multiple times in the data
      const htmlCount = packages.filter((pkg) => pkg === 'html').length
      expect(htmlCount).toBe(1)
    }
  })

  test('should not report typosquatting for packages in top packages list', async () => {
    const typosquattingMarshall = new TyposquattingMarshall({
      packageRepoUtils: {
        isPackageInAllowList: jest.fn(() => {
          return true
        })
      }
    })

    // Test with a package that exists in the top packages list
    const pkg = {
      packageName: 'express' // This should be in the top packages list
    }

    const result = await typosquattingMarshall.validate(pkg)
    expect(result).toEqual([])
  })

  test('should not report typosquatting for packages with no similar matches', async () => {
    const typosquattingMarshall = new TyposquattingMarshall({
      packageRepoUtils: {
        isPackageInAllowList: jest.fn(() => {
          return false // Simulate that the package is not in the allow list
        })
      }
    })

    // Test with a package that has no similar matches
    const pkg = {
      packageName: 'verylonganduniquenamethatdoesnotmatchanything'
    }

    const result = await typosquattingMarshall.validate(pkg)
    expect(result).toEqual([])
  })
})
