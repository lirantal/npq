'use strict'

const { isInteractiveTerminal } = require('../lib/helpers/cliSupportHandler')

const ciEnvVars = [
  'CI',
  'CONTINUOUS_INTEGRATION',
  'BUILD_NUMBER',
  'RUN_ID',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'TRAVIS',
  'CIRCLECI',
  'JENKINS_URL',
  'TEAMCITY_VERSION',
  'TF_BUILD'
]

describe('isInteractiveTerminal', () => {
  const originalStdinTTY = process.stdin.isTTY
  const originalStdoutTTY = process.stdout.isTTY
  const originalCiEnv = Object.fromEntries(ciEnvVars.map((envVar) => [envVar, process.env[envVar]]))

  afterEach(() => {
    process.stdin.isTTY = originalStdinTTY
    process.stdout.isTTY = originalStdoutTTY
    for (const envVar of ciEnvVars) {
      if (originalCiEnv[envVar] === undefined) delete process.env[envVar]
      else process.env[envVar] = originalCiEnv[envVar]
    }
  })

  test('requires both stdin and stdout to be TTYs', () => {
    for (const envVar of ciEnvVars) delete process.env[envVar]
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
