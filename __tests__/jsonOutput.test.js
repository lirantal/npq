'use strict'

const { createJsonOutput } = require('../lib/helpers/jsonOutput')

describe('createJsonOutput', () => {
  test('serializes a report with a trailing newline exactly once', () => {
    const write = jest.fn()
    const output = createJsonOutput(write)
    const report = { status: 'clean' }

    expect(output.hasWritten()).toBe(false)
    expect(output.write(report)).toBe(true)
    expect(output.write({ status: 'failed' })).toBe(false)

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(`${JSON.stringify(report)}\n`)
    expect(output.hasWritten()).toBe(true)
  })
})
