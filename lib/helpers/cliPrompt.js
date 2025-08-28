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
  let aborted = false
  let userProceeded = false

  // Setup stdin to capture keypresses during countdown
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()

    // Handle keypresses during countdown
    const onKeypress = (chunk) => {
      // Check for Ctrl+C (ASCII 3)
      if (chunk && chunk.length === 1 && chunk[0] === 3) {
        aborted = true
      }
      // Check for 'y' or 'Y' (ASCII 121 or 89)
      else if (chunk && chunk.length === 1 && (chunk[0] === 121 || chunk[0] === 89)) {
        userProceeded = true
      }
      // Ignore all other keypresses during countdown
    }

    process.stdin.on('data', onKeypress)

    // Cleanup function
    const cleanup = () => {
      process.stdin.removeListener('data', onKeypress)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
        process.stdin.pause()
      }
    }

    try {
      // Show countdown message with instruction in parentheses
      process.stdout.write(`${message}${timeInSeconds} (press 'y' to proceed)`)

      let currentNumber = timeInSeconds

      // Count down from timeInSeconds-1 to 1
      for (let i = timeInSeconds - 1; i > 0 && !aborted && !userProceeded; i--) {
        await setTimeout(1000)

        if (aborted || userProceeded) break

        // Update the countdown number using backspace
        // We need to backspace over both the number AND the instruction text
        const instructionText = " (press 'y' to proceed)"
        const totalTextLength = currentNumber.toString().length + instructionText.length

        // Backspace over everything, write new number and instruction
        const backspaces = '\b'.repeat(totalTextLength)
        process.stdout.write(`${backspaces}${i}${instructionText}`)

        currentNumber = i
      }

      if (!aborted && !userProceeded) {
        // Wait for the final second
        await setTimeout(1000)
      }

      // Move to a clean new line for any follow-up output
      if (!aborted) {
        console.log('') // Just move to next line
      }

      cleanup()

      if (aborted) {
        const abortError = new Error('Operation aborted by user')
        abortError.code = 'USER_ABORT'
        abortError.exitCode = 1
        throw abortError
      }

      return { [name]: true }
    } catch (error) {
      cleanup()
      throw error
    }
  } else {
    // Fallback for non-TTY environments (tests, etc.)
    // Show countdown message with instruction
    process.stdout.write(`${message}${timeInSeconds} (press 'y' to proceed)`)

    // Count down from timeInSeconds-1 to 1
    for (let i = timeInSeconds - 1; i > 0; i--) {
      await setTimeout(1000)

      // Update similar to TTY version - backspace over number and instruction
      const instructionText = " (press 'y' to proceed)"
      const prevNumber = i + 1
      const totalTextLength = prevNumber.toString().length + instructionText.length

      // Backspace over everything, write new number and instruction
      const backspaces = '\b'.repeat(totalTextLength)
      process.stdout.write(`${backspaces}${i}${instructionText}`)
    }

    // Wait for the final second
    await setTimeout(1000)

    // Move to next line after countdown completes
    console.log('')

    return { [name]: true }
  }
}

module.exports = {
  prompt,
  autoContinue
}
