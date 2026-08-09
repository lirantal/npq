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

  test('reports completion only after the underlying write drains', () => {
    let drain
    const write = jest.fn((value, callback) => {
      drain = callback
    })
    const output = createJsonOutput(write)
    const complete = jest.fn()

    expect(output.write({ status: 'clean' }, complete)).toBe(true)
    expect(complete).not.toHaveBeenCalled()

    drain()

    expect(complete).toHaveBeenCalledTimes(1)
  })
})
