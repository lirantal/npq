'use strict'

const { setTimeout } = require('node:timers/promises')
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
  } catch (error) {
    // Handle Ctrl+C gracefully - user cancelled the operation
    if (error.code === 'ABORT_ERR') {
      // Throw a specific error that can be caught and handled by the caller
      const abortError = new Error('Operation aborted by user')
      abortError.code = 'USER_ABORT'
      abortError.exitCode = 1
      throw abortError
    }
    throw error
  } finally {
    rl.close()
  }
}

async function autoContinue({ name, message, timeInSeconds = 5 } = {}) {
  // Show initial message with countdown
  process.stdout.write(`${message}${timeInSeconds}`)

  // Count down from timeInSeconds-1 to 1
  for (let i = timeInSeconds - 1; i > 0; i--) {
    await setTimeout(1000)

    // Calculate how many characters to backspace (previous number length)
    const prevNumber = i + 1
    const prevLength = prevNumber.toString().length
    const currentLength = i.toString().length

    // Backspace to beginning of number
    const backspaces = '\b'.repeat(prevLength)

    // Write new number and pad with spaces if needed to clear any remaining digits
    const padding = ' '.repeat(Math.max(0, prevLength - currentLength))
    const moveBack = '\b'.repeat(Math.max(0, prevLength - currentLength))

    process.stdout.write(`${backspaces}${i}${padding}${moveBack}`)
  }

  // Wait for the final second
  await setTimeout(1000)

  // Move to next line after countdown completes
  console.log()

  return { [name]: true }
}

module.exports = {
  prompt,
  autoContinue
}
