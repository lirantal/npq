'use strict'

const { CI_ENV_VARS, isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

describe('isInteractiveTerminal', () => {
  const originalStdinTTY = process.stdin.isTTY
  const originalStdoutTTY = process.stdout.isTTY
  const originalCiEnv = Object.fromEntries(
    CI_ENV_VARS.map((envVar) => [envVar, process.env[envVar]])
  )

  afterEach(() => {
    process.stdin.isTTY = originalStdinTTY
    process.stdout.isTTY = originalStdoutTTY
    for (const envVar of CI_ENV_VARS) {
      if (originalCiEnv[envVar] === undefined) delete process.env[envVar]
      else process.env[envVar] = originalCiEnv[envVar]
    }
  })

  test('requires both stdin and stdout to be TTYs', () => {
    for (const envVar of CI_ENV_VARS) delete process.env[envVar]
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
