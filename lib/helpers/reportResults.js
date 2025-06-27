const { styleText } = require('node:util')

/**
 * Report scan results to the console with colored formatting
 * @param {Array} results - Array of package scan results
 * @param {string} results[].pkg - Package name
 * @param {Array<Array>} results[].errors - Array of error arrays, each containing error objects with pkg and message
 * @param {Array<Array>} results[].warnings - Array of warning arrays, each containing warning objects with pkg and message
 */
function reportResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return
  }

  results.forEach((result, index) => {
    // Add spacing between packages (except for the first one)
    if (index > 0) {
      console.log()
    }

    // Display package name in bold and underlined
    const packageName = styleText(['bold'], result.pkg)
    const prefix = styleText(['gray'], `${'│'}`)
    const prompt = styleText(['gray', 'dim'], ` ${'>'} `)
    const separator = styleText(['dim'], `${'·'}`)
    console.log()
    console.log(` ${prefix} ${prompt} ${packageName}`)
    console.log(` ${prefix}`)

    // TBD later change to actually calc'ing it instead of hardcoding
    const maxTextLength = 'Supply Chain Security'.length

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((errorArray) => {
        // Each error is actually an array of error objects
        errorArray.forEach((error) => {
          const marshallTag = styleText(['gray'], `${error.marshall}:`)
          const messageText = error.message
          const topic = styleText(['red'], error.categoryFriendlyName.padEnd(maxTextLength, ' '))
          const icon = styleText(['red', 'bold'], `✖`)
          const errorLine = ` ${prefix} ${icon} ${topic} ${separator} ${messageText} `
          console.log(errorLine)
        })
      })
    }

    // Display warnings with yellow color and ✖ symbol
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((warningArray) => {
        // Each warning is actually an array of warning objects
        warningArray.forEach((warning) => {
          const marshallTag = styleText(['gray'], `${warning.marshall}:`)
          const messageText = warning.message
          const topic = styleText(
            ['yellow'],
            warning.categoryFriendlyName.padEnd(maxTextLength, ' ')
          )
          const icon = styleText(['yellow', 'bold'], `✖`)

          const warningLine = ` ${prefix} ${icon} ${topic} ${separator} ${messageText} `
          console.log(warningLine)
        })
      })
    }
  })
}

module.exports = { reportResults }
