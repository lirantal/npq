beforeEach(() => {
  jest.resetModules()
})

test('collecting marshalls resolves with files array', async () => {
  const marshalls = require('../lib/marshalls')

  jest.mock('glob', () => {
    return jest.fn((pattern, options, callback) => {
      return callback(null, ['file1', 'file2'])
    })
  })

  const marshallFiles = await marshalls.collectMarshalls()
  expect(marshallFiles).toEqual(['file1', 'file2'])
})

test('collecting marshalls resolves with error if unable to process files', () => {
  const marshalls = require('../lib/marshalls')

  jest.mock('glob', () => {
    return jest.fn((pattern, options, callback) => {
      return callback(new Error('some error'), null)
    })
  })

  expect(marshalls.collectMarshalls()).rejects.toEqual(expect.any(Error))
})

test('build marshalls without any should throw error', () => {
  const marshalls = require('../lib/marshalls')

  expect(marshalls.buildMarshallTasks([])).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks({})).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks(5)).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks('something')).rejects.toEqual(
    expect.any(Error)
  )
})
