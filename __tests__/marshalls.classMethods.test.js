const marshalls = require('../lib/marshalls')

jest.mock('glob', () => {
  return jest.fn((pattern, options, callback) => {
    if (pattern === 'testOk') {
      return callback(null, ['file1', 'file2'])
    } else {
      return callback(new Error('some error'), null)
    }
  })
})

test('collecting marshalls resolves with files array', async () => {
  marshalls.GLOB_MARSHALLS = 'testOk' // trigger success branch
  const marshallFiles = await marshalls.collectMarshalls()

  expect(marshallFiles).toEqual(['file1', 'file2'])
})

test('collecting marshalls resolves with error if unable to process files', () => {
  marshalls.GLOB_MARSHALLS = 'error' // trigger failure branch

  expect(marshalls.collectMarshalls()).rejects.toEqual(expect.any(Error))
})

test('build marshalls without any should throw error', () => {
  expect(marshalls.buildMarshallTasks([])).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks({})).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks(5)).rejects.toEqual(expect.any(Error))
  expect(marshalls.buildMarshallTasks('something')).rejects.toEqual(
    expect.any(Error)
  )
})
