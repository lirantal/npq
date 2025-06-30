const { styleText } = require('node:util')
const { marshallCategories } = require('../marshalls/constants')

/**
 * Report scan results to the console with colored formatting
 * @param {Array} marshallResults - Array of package scan results
 * @param {string} results[].pkg - Package name
 * @param {Array<Array>} results[].errors - Array of error arrays, each containing error objects with pkg and message
 * @param {Array<Array>} results[].warnings - Array of warning arrays, each containing warning objects with pkg and message
 */
function reportResults(marshallResults) {
  // Convert results to issues per package
  results = marshallResultsToIssuesPerPackage(marshallResults)

  let resultsForPrettyPrint = ''
  let resultsForJSON = results
  let resultsForNormalPrint = ''

  if (!Array.isArray(results) || results.length === 0) {
    return
  }

  let countErrors = 0
  let countWarnings = 0

  results.forEach((result, index) => {
    // Add spacing between packages (except for the first one)
    if (index > 0) {
      resultsForPrettyPrint += '\n'
    }

    // Display package name in bold and underlined
    const packageName = styleText(['bold'], result.pkg)
    const prefix = styleText(['gray'], `${'│'}`)
    const prompt = styleText(['gray', 'dim'], `${'>'} `)
    const separator = styleText(['dim'], `${'·'}`)

    resultsForPrettyPrint += `\n`
    resultsForPrettyPrint += `\n ${styleText(['dim'], '┌─')}`
    resultsForPrettyPrint += `\n ${prefix} ${prompt} ${packageName}`
    resultsForPrettyPrint += `\n ${prefix}`

    // TBD later change to actually calc'ing it instead of hardcoding
    const maxTextLength = 'Supply Chain Security'.length

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((errorArray) => {
        countErrors += errorArray.length
        // Each error is actually an array of error objects
        errorArray.forEach((error) => {
          // const marshallTag = styleText(['gray'], `${error.marshall}:`)
          const messageText = error.message
          const topic = styleText(['red'], error.categoryFriendlyName.padEnd(maxTextLength, ' '))
          const icon = styleText(['red', 'bold'], `✖`)
          const errorLine = ` ${prefix} ${icon} ${topic} ${separator} ${messageText} `
          resultsForPrettyPrint += `\n${errorLine}`
        })
      })
    }

    // Display warnings with yellow color and ✖ symbol
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((warningArray) => {
        countWarnings += warningArray.length
        // Each warning is actually an array of warning objects
        warningArray.forEach((warning) => {
          // const marshallTag = styleText(['gray'], `${warning.marshall}:`)
          const messageText = warning.message
          const topic = styleText(
            ['yellow'],
            warning.categoryFriendlyName.padEnd(maxTextLength, ' ')
          )
          const icon = styleText(['yellow', 'bold'], `✖`)

          const warningLine = ` ${prefix} ${icon} ${topic} ${separator} ${messageText} `
          resultsForPrettyPrint += `\n${warningLine}`
        })
      })
    }

    resultsForPrettyPrint += `\n ${styleText(['dim'], '└─')}`
  })

  return {
    countErrors,
    countWarnings,
    resultsForPrettyPrint,
    resultsForJSON,
    resultsForNormalPrint
  }
}

function marshallResultsToIssuesPerPackage(results) {
  const issuesPerPackage = []
  for (const pkg in results) {
    const allMarshallResultsList = results[pkg]
    const issues = {
      pkg,
      errors: [],
      warnings: []
    }
    for (const marshall of allMarshallResultsList) {
      for (const [key, value] of Object.entries(marshall)) {
        if (value.errors && value.errors.length > 0) {
          const marshallErrors = value.errors.map((error) => {
            return {
              marshall: value.marshall,
              categoryId: value.categoryId,
              categoryFriendlyName: marshallCategories[value.categoryId].title,
              ...error
            }
          })
          issues.errors.push(marshallErrors)
        }
        if (value.warnings && value.warnings.length > 0) {
          const marshallWarnings = value.warnings.map((warning) => {
            return {
              marshall: value.marshall,
              categoryId: value.categoryId,
              categoryFriendlyName: marshallCategories[value.categoryId].title,
              ...warning
            }
          })

          issues.warnings.push(marshallWarnings)
        }
      }
    }
    if (issues.errors.length > 0 || issues.warnings.length > 0) {
      issuesPerPackage.push(issues)
    }
  }

  return issuesPerPackage
}

module.exports = { reportResults, marshallResultsToIssuesPerPackage }
