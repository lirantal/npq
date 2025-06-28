'use strict'

const readline = require('node:readline/promises')
const { stdin, stdout } = require('node:process')

/**
 * Simple CLI prompt for yes/no confirmation
 * @param {Object} options - Prompt options
 * @param {string} options.name - The property name for the result (e.g., 'install')
 * @param {string} options.message - The question to ask
 * @param {boolean} [options.default=false] - Default answer if user just presses Enter
 * @returns {Promise<Object>} - Object with the specified property name and boolean value
 */
async function prompt(options = {}) {
  const { name, message, default: defaultValue = false } = options

  if (!message) {
    throw new Error('Message is required for prompt')
  }

  if (!name) {
    throw new Error('Name is required for prompt')
  }

  const rl = readline.createInterface({
    input: stdin,
    output: stdout
  })

  try {
    // Format the prompt message with default indicator
    const defaultIndicator = defaultValue ? 'Y/n' : 'y/N'
    const promptMessage = `${message} (${defaultIndicator}) `

    const answer = await rl.question(promptMessage)

    // Parse the answer
    const normalizedAnswer = answer.trim().toLowerCase()

    let result
    if (normalizedAnswer === '') {
      // User pressed Enter without typing anything, use default
      result = defaultValue
    } else if (['y', 'yes'].includes(normalizedAnswer)) {
      result = true
    } else if (['n', 'no'].includes(normalizedAnswer)) {
      result = false
    } else {
      // Invalid input, ask again
      rl.close()
      console.log('Please answer with y/yes or n/no.')
      return prompt(options)
    }

    return { [name]: result }
  } finally {
    rl.close()
  }
}

module.exports = {
  prompt
}
