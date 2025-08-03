const { styleText } = require('node:util')
const { marshallCategories } = require('../marshalls/constants')
const { isInteractiveTerminal } = require('./cliSupportHandler')

/**
 * Get terminal width, with fallback to a reasonable default
 * @returns {number} Terminal width in columns
 */
function getTerminalWidth() {
  try {
    if (process.stdout.isTTY && process.stdout.getWindowSize) {
      const [columns] = process.stdout.getWindowSize()
      return columns
    }
  } catch (error) {
    // Fallback if terminal size detection fails
  }
  return 80 // Default fallback width
}

/**
 * Strip ANSI escape codes from a string to get its actual display length
 * @param {string} str - String that may contain ANSI codes
 * @returns {number} Actual display length
 */
function getDisplayLength(str) {
  // Remove ANSI escape sequences to get actual character count
  return str.replace(/\u001b\[[0-9;]*m/g, '').length
}

/**
 * Wrap text to fit within terminal width while maintaining indentation
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width for each line
 * @param {string} indent - Indentation string for continuation lines
 * @returns {string} Wrapped text with proper indentation
 */
function wrapTextWithIndent(text, maxWidth, indent) {
  if (getDisplayLength(text) <= maxWidth) {
    return text
  }

  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word

    if (getDisplayLength(testLine) <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        // Single word is longer than maxWidth, break it
        lines.push(word)
        currentLine = ''
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  // Join lines with proper indentation
  return lines
    .map((line, index) => {
      return index === 0 ? line : `\n${indent}${line}`
    })
    .join('')
}

/**
 * Report scan results to the console with colored formatting
 * @param {Array} marshallResults - Array of package scan results
 * @param {string} results[].pkg - Package name
 * @param {Array<Array>} results[].errors - Array of error arrays, each containing error objects with pkg and message
 * @param {Array<Array>} results[].warnings - Array of warning arrays, each containing warning objects with pkg and message
 */
function reportResults(marshallResults, { plain = false } = {}) {
  // Convert results to issues per package
  const results = marshallResultsToIssuesPerPackage(marshallResults)

  let resultsForPrettyPrint = ''
  let resultsForJSON = results
  let resultsForPlainTextPrint = ''

  let summaryForPrettyPrint = ''
  let summaryForPlainTextPrint = ''
  // @TODO: add support for JSON output
  // let summaryForJSON =

  if (!Array.isArray(results) || results.length === 0) {
    return
  }

  // Check if we should use rich formatting
  const useRichFormatting = isInteractiveTerminal() && !plain

  // Get terminal width for text wrapping
  const terminalWidth = getTerminalWidth()

  let countErrors = 0
  let countWarnings = 0
  let countPackages = results.length

  results.forEach((result, index) => {
    // Add spacing between packages (except for the first one)
    if (index > 0) {
      resultsForPrettyPrint += ''
      resultsForPlainTextPrint += '\n'
    }

    // Rich formatting version
    const packageNameRich = styleText(['bold'], result.pkg)
    const prefixRich = styleText(['gray'], `${'│'}`)
    const promptRich = styleText(['gray', 'dim'], `${'>'} `)
    const separatorRich = styleText(['dim'], `${'·'}`)

    resultsForPrettyPrint += `\n ${styleText(['dim'], '┌─')}`
    resultsForPrettyPrint += `\n ${prefixRich} ${promptRich} ${packageNameRich}`
    resultsForPrettyPrint += `\n ${prefixRich}`

    // Plain text version
    resultsForPlainTextPrint += `\n--- Package: ${result.pkg} ---`

    // TBD later change to actually calc'ing it instead of hardcoding
    const maxTextLength = 'Supply Chain Security'.length

    // Calculate the prefix length for indentation (without ANSI codes)
    // Format: " │ ✖ Supply Chain Security · "
    const basePrefix = ` │ ✖ `
    const topicPadding = maxTextLength + 0 // +1 for space after topic
    const separatorLength = 3 // ` · `
    const prefixLength = basePrefix.length + topicPadding + separatorLength
    const maxMessageWidth = terminalWidth - prefixLength - 2 // -2 for safety margin

    // Create indentation string for wrapped lines - include the │ prefix and align with message start
    const indentString = ` ${styleText(['gray'], '│')} ${' '.repeat(prefixLength - 3)}`

    let isPackageMalicious = null

    if (result.errors && result.errors.length > 0) {
      for (const errorArray of result.errors) {
        isPackageMalicious = errorArray.find((error) => {
          return error.message.includes('Malicious package found')
        })

        if (isPackageMalicious) {
          break
        }
      }

      if (isPackageMalicious) {
        countErrors = 1

        // Rich formatting version
        const topicRich = styleText(
          ['red', 'bold'],
          isPackageMalicious.categoryFriendlyName.padEnd(maxTextLength, ' ')
        )
        const iconRich = styleText(['red', 'bold'], `✖`)
        const errorLineRich = ` ${prefixRich} ${iconRich} ${topicRich} ${separatorRich} ${isPackageMalicious.message} `
        resultsForPrettyPrint += `\n${errorLineRich}`

        // Plain text version
        resultsForPlainTextPrint += `\n  ERROR: ${isPackageMalicious.categoryFriendlyName} - ${isPackageMalicious.message}`
      } else {
        for (const errorArray of result.errors) {
          countErrors += errorArray.length
          // Each error is actually an array of error objects
          errorArray.forEach((error) => {
            const messageText = error.message

            // Rich formatting version
            const topicRich = styleText(
              ['red', 'bold'],
              error.categoryFriendlyName.padEnd(maxTextLength, ' ')
            )
            const iconRich = styleText(['red', 'bold'], `✖`)
            const wrappedMessage = wrapTextWithIndent(messageText, maxMessageWidth, indentString)
            const errorLineRich = ` ${prefixRich} ${iconRich} ${topicRich} ${separatorRich} ${wrappedMessage} `
            resultsForPrettyPrint += `\n${errorLineRich}`

            // Plain text version
            resultsForPlainTextPrint += `\n  ERROR: ${error.categoryFriendlyName} - ${messageText}`
          })
        }
      }
    }

    // Display warnings with yellow color and ⚠ symbol
    if (!isPackageMalicious && result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((warningArray) => {
        countWarnings += warningArray.length
        // Each warning is actually an array of warning objects
        warningArray.forEach((warning) => {
          const messageText = warning.message

          // Rich formatting version
          const topicRich = styleText(
            ['yellow'],
            warning.categoryFriendlyName.padEnd(maxTextLength, ' ')
          )
          const iconRich = styleText(['yellow', 'bold'], `⚠`)
          const wrappedMessage = wrapTextWithIndent(messageText, maxMessageWidth, indentString)
          const warningLineRich = ` ${prefixRich} ${iconRich} ${topicRich} ${separatorRich} ${wrappedMessage} `
          resultsForPrettyPrint += `\n${warningLineRich}`

          // Plain text version
          resultsForPlainTextPrint += `\n  WARNING: ${warning.categoryFriendlyName} - ${messageText}`
        })
      })
    }

    // Close rich formatting box
    resultsForPrettyPrint += `\n ${styleText(['dim'], '└─')}`
  })

  const maxTextLength = 'Total packages:'.length

  // Rich formatting summary
  summaryForPrettyPrint += `\n\n${styleText(['bold'], 'Summary:')}\n`
  summaryForPrettyPrint += `\n - ${'Total packages:'.padEnd(maxTextLength, ' ')} ${styleText(
    ['bold'],
    String(countPackages)
  )}`
  summaryForPrettyPrint += `\n - ${'Total errors:'.padEnd(maxTextLength, ' ')} ${styleText(
    ['red', 'bold'],
    String(countErrors)
  )}`
  summaryForPrettyPrint += `\n - ${'Total warnings:'.padEnd(maxTextLength, ' ')} ${styleText(
    ['yellow', 'bold'],
    String(countWarnings)
  )}`
  summaryForPrettyPrint += `\n`

  // Plain text summary
  summaryForPlainTextPrint += `\n\nSummary:\n`
  summaryForPlainTextPrint += `\n - Total packages: ${countPackages}`
  summaryForPlainTextPrint += `\n - Total errors: ${countErrors}`
  summaryForPlainTextPrint += `\n - Total warnings: ${countWarnings}`
  summaryForPlainTextPrint += `\n`

  return {
    countErrors,
    countWarnings,
    resultsForPrettyPrint,
    resultsForJSON,
    resultsForPlainTextPrint,
    summaryForPrettyPrint,
    summaryForPlainTextPrint,
    useRichFormatting
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
      for (const value of Object.values(marshall)) {
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
