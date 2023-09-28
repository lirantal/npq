beforeEach(() => {
  jest.resetModules()
})

jest.mock('glob', () => {
  return {
    glob: jest.fn().mockResolvedValue(['file1', 'file2'])
  }
})

test('collecting marshalls resolves with files array', async () => {
  const marshalls = require('../lib/marshalls')

  const marshallFiles = await marshalls.collectMarshalls()
  expect(marshallFiles).toEqual(['file1', 'file2'])
})

test('collecting marshalls resolves with error if unable to process files', () => {
  const marshalls = require('../lib/marshalls')

  jest.mock('glob', () => {
    return {
      glob: jest.fn().mockRejectedValue(new Error('error'))
    }
  })

  expect(marshalls.collectMarshalls()).rejects.toEqual(expect.any(Error))
})

test('build marshalls without any should throw error', () => {
  const marshalls = require('../lib/marshalls')

  expect(marshalls.buildMarshallTasks([])).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks({})).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks(5)).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks('something')).rejects.toEqual(expect.any(Error))
})
