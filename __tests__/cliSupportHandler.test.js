'use strict'

const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

describe('isInteractiveTerminal', () => {
  const originalStdinTTY = process.stdin.isTTY
  const originalStdoutTTY = process.stdout.isTTY
  const originalCI = process.env.CI

  afterEach(() => {
    process.stdin.isTTY = originalStdinTTY
    process.stdout.isTTY = originalStdoutTTY
    if (originalCI === undefined) delete process.env.CI
    else process.env.CI = originalCI
  })

  test('requires both stdin and stdout to be TTYs', () => {
    delete process.env.CI
    process.stdin.isTTY = true
    process.stdout.isTTY = true
    expect(isInteractiveTerminal()).toBe(true)

    process.stdin.isTTY = false
    expect(isInteractiveTerminal()).toBe(false)
  })

  test('rejects a CI environment even when both streams are TTYs', () => {
    process.stdin.isTTY = true
    process.stdout.isTTY = true
    process.env.CI = 'true'
    expect(isInteractiveTerminal()).toBe(false)
  })
})
