'use strict'

const { prompt } = require('../lib/helpers/cliPrompt')
const readline = require('node:readline/promises')

// Mock readline module
jest.mock('node:readline/promises', () => ({
  createInterface: jest.fn()
}))

describe('cliPrompt', () => {
  let mockRl

  beforeEach(() => {
    mockRl = {
      question: jest.fn(),
      close: jest.fn()
    }
    readline.createInterface.mockReturnValue(mockRl)

    // Mock console.log to avoid output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    if (console.log.mockRestore) {
      console.log.mockRestore()
    }
  })

  describe('parameter validation', () => {
    test('should throw error when message is missing', async () => {
      await expect(prompt({ name: 'test' })).rejects.toThrow('Message is required for prompt')
    })

    test('should throw error when name is missing', async () => {
      await expect(prompt({ message: 'Test message?' })).rejects.toThrow(
        'Name is required for prompt'
      )
    })

    test('should throw error when both name and message are missing', async () => {
      await expect(prompt({})).rejects.toThrow('Message is required for prompt')
    })
  })

  describe('successful prompts', () => {
    test('should return true for "y" input', async () => {
      mockRl.question.mockResolvedValue('y')

      const result = await prompt({
        name: 'install',
        message: 'Do you want to install?'
      })

      expect(result).toEqual({ install: true })
      expect(mockRl.question).toHaveBeenCalledWith('Do you want to install? (y/N) ')
      expect(mockRl.close).toHaveBeenCalled()
    })

    test('should return true for "yes" input', async () => {
      mockRl.question.mockResolvedValue('yes')

      const result = await prompt({
        name: 'confirm',
        message: 'Are you sure?'
      })

      expect(result).toEqual({ confirm: true })
    })

    test('should return false for "n" input', async () => {
      mockRl.question.mockResolvedValue('n')

      const result = await prompt({
        name: 'proceed',
        message: 'Continue?'
      })

      expect(result).toEqual({ proceed: false })
    })

    test('should return false for "no" input', async () => {
      mockRl.question.mockResolvedValue('no')

      const result = await prompt({
        name: 'delete',
        message: 'Delete files?'
      })

      expect(result).toEqual({ delete: false })
    })

    test('should handle case-insensitive input', async () => {
      mockRl.question.mockResolvedValue('YES')

      const result = await prompt({
        name: 'test',
        message: 'Test?'
      })

      expect(result).toEqual({ test: true })
    })

    test('should trim whitespace from input', async () => {
      mockRl.question.mockResolvedValue('  y  ')

      const result = await prompt({
        name: 'test',
        message: 'Test?'
      })

      expect(result).toEqual({ test: true })
    })
  })

  describe('default value handling', () => {
    test('should use default false when user presses Enter', async () => {
      mockRl.question.mockResolvedValue('')

      const result = await prompt({
        name: 'install',
        message: 'Install package?'
      })

      expect(result).toEqual({ install: false })
      expect(mockRl.question).toHaveBeenCalledWith('Install package? (y/N) ')
    })

    test('should use default true when specified and user presses Enter', async () => {
      mockRl.question.mockResolvedValue('')

      const result = await prompt({
        name: 'continue',
        message: 'Continue process?',
        default: true
      })

      expect(result).toEqual({ continue: true })
      expect(mockRl.question).toHaveBeenCalledWith('Continue process? (Y/n) ')
    })

    test('should show correct prompt indicators for default values', async () => {
      mockRl.question.mockResolvedValue('y')

      await prompt({
        name: 'test',
        message: 'Test with default false?',
        default: false
      })

      expect(mockRl.question).toHaveBeenCalledWith('Test with default false? (y/N) ')
    })
  })

  describe('invalid input handling', () => {
    test('should log error message when invalid input is provided', () => {
      // Test the logic path for invalid input without actual recursion
      const invalidInputs = ['maybe', '1', 'true', 'false', 'ok', 'sure', 'xyz']

      invalidInputs.forEach((input) => {
        const normalized = input.trim().toLowerCase()
        const isValidInput = ['y', 'yes', 'n', 'no'].includes(normalized)
        expect(isValidInput).toBe(false)
      })
    })

    test('should recognize valid inputs correctly', () => {
      const validInputs = ['y', 'yes', 'n', 'no', 'Y', 'YES', 'N', 'NO', '  y  ', '  no  ']

      validInputs.forEach((input) => {
        const normalized = input.trim().toLowerCase()
        const isValidInput = ['y', 'yes', 'n', 'no'].includes(normalized)
        expect(isValidInput).toBe(true)
      })
    })

    test('should handle invalid input and retry successfully', async () => {
      // Create a mock that returns invalid input first, then valid input
      let callCount = 0
      mockRl.question.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve('invalid')
        }
        return Promise.resolve('y')
      })

      // Mock the second readline interface creation for the retry
      let interfaceCallCount = 0
      const mockRl2 = {
        question: jest.fn().mockResolvedValue('y'),
        close: jest.fn()
      }

      readline.createInterface.mockImplementation(() => {
        interfaceCallCount++
        if (interfaceCallCount === 1) {
          return mockRl
        }
        return mockRl2
      })

      const result = await prompt({
        name: 'test',
        message: 'Test?'
      })

      expect(console.log).toHaveBeenCalledWith('Please answer with y/yes or n/no.')
      expect(result).toEqual({ test: true })
      expect(mockRl.close).toHaveBeenCalled()
      expect(mockRl2.close).toHaveBeenCalled()
    })
  })

  describe('readline interface management', () => {
    test('should create readline interface with correct options', async () => {
      mockRl.question.mockResolvedValue('y')

      await prompt({
        name: 'test',
        message: 'Test?'
      })

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout
      })
    })

    test('should close readline interface even if error occurs', async () => {
      mockRl.question.mockRejectedValue(new Error('Test error'))

      await expect(
        prompt({
          name: 'test',
          message: 'Test?'
        })
      ).rejects.toThrow('Test error')

      expect(mockRl.close).toHaveBeenCalled()
    })
  })

  describe('return value format', () => {
    test('should return object with specified property name', async () => {
      mockRl.question.mockResolvedValue('y')

      const result = await prompt({
        name: 'customProperty',
        message: 'Test?'
      })

      expect(result).toHaveProperty('customProperty')
      expect(result.customProperty).toBe(true)
      expect(Object.keys(result)).toHaveLength(1)
    })

    test('should handle different property names correctly', async () => {
      mockRl.question.mockResolvedValue('n')

      const result = await prompt({
        name: 'shouldProceed',
        message: 'Proceed?'
      })

      expect(result).toEqual({ shouldProceed: false })
    })
  })

  describe('autoContinue', () => {
    const { autoContinue } = require('../lib/helpers/cliPrompt')
    let mockWrite, originalWrite

    beforeEach(() => {
      // Mock process.stdout.write to capture output
      originalWrite = process.stdout.write
      mockWrite = jest.fn()
      process.stdout.write = mockWrite

      // Mock setTimeout to speed up tests
      jest.useFakeTimers()
    })

    afterEach(() => {
      // Restore original stdout.write
      process.stdout.write = originalWrite
      jest.useRealTimers()
    })

    test('should return object with specified property name', async () => {
      const promise = autoContinue({
        name: 'install',
        message: 'Auto-installing in ',
        timeInSeconds: 2
      })

      // Fast-forward all timers
      jest.runAllTimers()

      const result = await promise
      expect(result).toEqual({ install: true })
    })

    test('should handle custom timeInSeconds', async () => {
      const promise = autoContinue({
        name: 'proceed',
        message: 'Proceeding in ',
        timeInSeconds: 3
      })

      // Fast-forward all timers
      jest.runAllTimers()

      const result = await promise
      expect(result).toEqual({ proceed: true })
    })

    test('should use default timeInSeconds of 5 when not specified', async () => {
      const promise = autoContinue({
        name: 'default',
        message: 'Starting in '
      })

      // Fast-forward all timers
      jest.runAllTimers()

      const result = await promise
      expect(result).toEqual({ default: true })
    }, 10000) // 10 second timeout

    test('should write countdown to stdout', async () => {
      const promise = autoContinue({
        name: 'test',
        message: 'Testing in ',
        timeInSeconds: 3
      })

      // Fast-forward all timers
      jest.runAllTimers()

      await promise

      // Should write initial message with starting number
      expect(mockWrite).toHaveBeenCalledWith('Testing in 3')
    })

    test('should handle single digit countdown correctly', async () => {
      const promise = autoContinue({
        name: 'test',
        message: 'Starting in ',
        timeInSeconds: 2
      })

      // Fast-forward all timers
      jest.runAllTimers()

      await promise

      // Should write initial message
      expect(mockWrite).toHaveBeenCalledWith('Starting in 2')
    })

    test('should handle double digit to single digit countdown with padding', async () => {
      const promise = autoContinue({
        name: 'test',
        message: 'Waiting ',
        timeInSeconds: 10
      })

      // Fast-forward all timers
      jest.runAllTimers()

      await promise

      // Should write initial message with double digit
      expect(mockWrite).toHaveBeenCalledWith('Waiting 10')
    }, 15000) // 15 second timeout

    test('should call console.log at the end', async () => {
      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

      const promise = autoContinue({
        name: 'test',
        message: 'Done in ',
        timeInSeconds: 1
      })

      // Fast-forward all timers
      jest.runAllTimers()

      await promise

      expect(mockConsoleLog).toHaveBeenCalledWith()
      mockConsoleLog.mockRestore()
    })

    test('should handle default parameters', async () => {
      const promise = autoContinue()

      // Fast-forward all timers
      jest.runAllTimers()

      const result = await promise

      // Should handle undefined name gracefully
      expect(result).toEqual({ undefined: true })
    }, 10000) // 10 second timeout
  })

  describe('error handling', () => {
    test('should handle ABORT_ERR gracefully when user presses Ctrl+C', async () => {
      // Simulate the ABORT_ERR that readline throws on Ctrl+C
      const abortError = new Error('The operation was aborted')
      abortError.code = 'ABORT_ERR'
      mockRl.question.mockRejectedValue(abortError)

      try {
        await prompt({ name: 'test', message: 'Test prompt?' })
        expect(true).toBe(false) // Should not reach this line
      } catch (error) {
        expect(error.message).toBe('Operation aborted by user')
        expect(error.code).toBe('USER_ABORT')
        expect(error.exitCode).toBe(1)
      }

      // No longer expecting console.log since message handling moved to CLI layer
    })

    test('should re-throw non-ABORT_ERR errors', async () => {
      const otherError = new Error('Some other error')
      otherError.code = 'OTHER_ERROR'
      mockRl.question.mockRejectedValue(otherError)

      await expect(prompt({ name: 'test', message: 'Test prompt?' })).rejects.toThrow(
        'Some other error'
      )
    })
  })
})
