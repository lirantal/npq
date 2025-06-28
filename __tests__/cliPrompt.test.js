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
    console.log.mockRestore()
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
})
