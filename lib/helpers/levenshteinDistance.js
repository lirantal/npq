'use strict'

/**
 * Calculates the Levenshtein distance between two strings.
 * Uses the Wagner-Fischer algorithm with single-row space optimization
 * and optional early termination when distance exceeds maxDistance.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @param {number} [maxDistance] - Optional maximum distance threshold for early termination
 * @returns {number} The Levenshtein edit distance between the two strings
 */
function levenshteinDistance(a, b, maxDistance) {
  // Handle edge cases
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    const temp = a
    a = b
    b = temp
  }

  const aLen = a.length
  const bLen = b.length

  // Early termination: if length difference exceeds maxDistance, no need to compute
  if (maxDistance !== undefined && bLen - aLen >= maxDistance) {
    return bLen - aLen
  }

  // Initialize the previous row (represents distances for empty string a prefix)
  let prevRow = new Array(aLen + 1)
  for (let i = 0; i <= aLen; i++) {
    prevRow[i] = i
  }

  // Current row for computation
  let currRow = new Array(aLen + 1)

  // Fill in the matrix row by row
  for (let j = 1; j <= bLen; j++) {
    currRow[0] = j

    let rowMin = currRow[0]

    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1

      currRow[i] = Math.min(
        prevRow[i] + 1, // deletion
        currRow[i - 1] + 1, // insertion
        prevRow[i - 1] + cost // substitution
      )

      if (currRow[i] < rowMin) {
        rowMin = currRow[i]
      }
    }

    // Early termination: if minimum value in current row exceeds maxDistance,
    // the final distance will also exceed maxDistance
    if (maxDistance !== undefined && rowMin >= maxDistance) {
      return rowMin
    }

    // Swap rows
    const temp = prevRow
    prevRow = currRow
    currRow = temp
  }

  return prevRow[aLen]
}

module.exports = { levenshteinDistance }
