'use strict'

/* eslint-disable security/detect-non-literal-fs-filename -- paths stay inside per-test temp dirs */

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { CODING_AGENT_ENVIRONMENT_VARIABLES } = require('../lib/helpers/codingAgentEnvironment')

const root = path.resolve(__dirname, '..')
const npqBinary = path.join(root, 'bin/npq.js')
const heroBinary = path.join(root, 'bin/npq-hero.js')
const preload = path.join(__dirname, '__fixtures__/json-process-preload.js')
let fixtureDirectory
let packageManagerMarker
let packageManagerLauncher

function createPackageManagerLauncher() {
  const launcherProgram = [
    '#!/usr/bin/env node',
    "'use strict'",
    '',
    "require('node:fs').writeFileSync(",
    `  ${JSON.stringify(packageManagerMarker)},`,
    "  'ran'",
    ')',
    'process.exit(0)',
    ''
  ].join('\n')

  if (process.platform === 'win32') {
    const launcherScript = path.join(fixtureDirectory, 'package-manager-launcher.js')
    packageManagerLauncher = path.join(fixtureDirectory, 'package-manager-launcher.cmd')
    fs.writeFileSync(launcherScript, launcherProgram)
    fs.writeFileSync(
      packageManagerLauncher,
      ['@echo off', `"${process.execPath}" "${launcherScript}" %*`, ''].join('\r\n')
    )
    return
  }

  packageManagerLauncher = path.join(fixtureDirectory, 'package-manager-launcher')
  fs.writeFileSync(packageManagerLauncher, launcherProgram)
  fs.chmodSync(packageManagerLauncher, 0o755)
}

function writeProject(packageJson = {}) {
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'npq-agent-process-'))
  packageManagerMarker = path.join(fixtureDirectory, 'package-manager-ran')
  fs.writeFileSync(path.join(fixtureDirectory, 'package.json'), JSON.stringify(packageJson))
  createPackageManagerLauncher()
}

function childEnvironment(signal, scenario = 'clean', extraEnvironment = {}) {
  const env = { ...process.env }
  for (const name of CODING_AGENT_ENVIRONMENT_VARIABLES) delete env[name]
  if (signal) env[signal.name] = signal.value
  env.NODE_OPTIONS = (env.NODE_OPTIONS || '').concat(' --require=', preload).trim()
  env.NPQ_JSON_TEST_SCENARIO = scenario
  env.NPQ_PKG_MGR = packageManagerLauncher
  return { ...env, ...extraEnvironment }
}

function run(binary, args, signal, scenario, extraEnvironment = {}) {
  return spawnSync(process.execPath, [binary, ...args], {
    cwd: fixtureDirectory,
    env: childEnvironment(signal, scenario, extraEnvironment),
    encoding: 'utf8',
    timeout: 10000
  })
}

function packageManagerRan() {
  return fs.existsSync(packageManagerMarker)
}

function expectJson(result, exitCode) {
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(exitCode)
  expect(result.stderr).toBe('')
  expect(result.stdout.endsWith('\n')).toBe(true)
  const report = JSON.parse(result.stdout)
  expect(result.stdout).toBe(`${JSON.stringify(report)}\n`)
  return report
}

function expectHumanOutput(result) {
  expect(result.stdout).not.toBe('')
  expect(result.stdout.endsWith('\n')).toBe(true)
  expect(() => JSON.parse(result.stdout)).toThrow()
}

beforeEach(() => {
  writeProject({ name: 'agent-process-project', version: '1.0.0' })
})

afterEach(() => {
  if (fixtureDirectory) fs.rmSync(fixtureDirectory, { recursive: true, force: true })
  fixtureDirectory = undefined
  packageManagerMarker = undefined
  packageManagerLauncher = undefined
})

describe('non-interactive executable routing', () => {
  test('npq blocks warning findings in ordinary non-TTY execution', () => {
    const result = run(npqBinary, ['install', 'express'], null, 'findings')

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(packageManagerRan()).toBe(false)
    expect([result.stdout, result.stderr].join('')).toContain('non-interactive')
  })

  test('npq installs warning findings with the explicit flag', () => {
    const result = run(
      npqBinary,
      ['install', 'express', '--allow-non-interactive-install'],
      null,
      'findings'
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(packageManagerRan()).toBe(true)
  })

  test('npq blocks error findings even with the explicit flag', () => {
    const result = run(
      npqBinary,
      ['install', 'express', '--allow-non-interactive-install'],
      null,
      'errors'
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(packageManagerRan()).toBe(false)
  })

  test('npq-hero installs warning findings with the environment opt-in and no countdown', () => {
    const result = run(heroBinary, ['install', 'express'], null, 'findings', {
      NPQ_ALLOW_NON_INTERACTIVE_INSTALL: 'true'
    })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain("press 'y' to proceed")
    expect(packageManagerRan()).toBe(true)
  })
})

describe('coding-agent executable routing', () => {
  test.each([
    { name: 'CLAUDECODE', value: '1' },
    { name: 'CODEX_THREAD_ID', value: 'thread-123' },
    { name: 'AGENT', value: 'amp' },
    { name: 'AI_AGENT', value: 'true' }
  ])('npq runs an authorized install when $name is present', (signal) => {
    const result = run(npqBinary, ['install', 'express'], signal, 'findings')

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expectHumanOutput(result)
    expect(packageManagerRan()).toBe(true)
  })

  test('npq-hero runs an authorized agent install through package-manager passthrough', () => {
    const result = run(
      heroBinary,
      ['install', 'express'],
      { name: 'CURSOR_AGENT', value: '1' },
      'findings'
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expectHumanOutput(result)
    expect(packageManagerRan()).toBe(true)
  })

  test('npq-hero preserves package-manager passthrough for an agent install without operands', () => {
    fs.writeFileSync(
      path.join(fixtureDirectory, 'package.json'),
      JSON.stringify({ dependencies: { express: '^5.0.0' } })
    )
    const result = run(heroBinary, ['install'], { name: 'GEMINI_CLI', value: '1' }, 'findings')

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expectHumanOutput(result)
    expect(result.stdout).toContain('Install script detected')
    expect(result.stdout).toContain('express@^5.0.0')
    expect(result.stdout).toContain('Total packages: 1')
    expect(packageManagerRan()).toBe(true)
  })

  test('npq-hero preserves non-install passthrough under agent detection', () => {
    const result = run(heroBinary, ['run', 'build'], { name: 'AGENT', value: 'goose' })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(packageManagerRan()).toBe(true)
  })

  test('npq blocks error findings under coding-agent install routing', () => {
    const result = run(
      npqBinary,
      ['install', 'express'],
      { name: 'CODEX_THREAD_ID', value: 'thread-123' },
      'errors'
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(packageManagerRan()).toBe(false)
  })

  test('explicit JSON remains audit-only under a coding-agent environment', () => {
    const result = run(
      npqBinary,
      ['install', 'express', '--json'],
      { name: 'CODEX_THREAD_ID', value: 'thread-123' },
      'findings'
    )
    const report = expectJson(result, 1)

    expect(report.status).toBe('findings')
    expect(packageManagerRan()).toBe(false)
  })

  test('npq-hero sanitizes invalid agent install input without passthrough', () => {
    const rawUrl = 'https://user:credential@example.test/package.tgz'
    const result = run(heroBinary, ['install', rawUrl], {
      name: 'CLAUDE_CODE_CHILD_SESSION',
      value: '1'
    })
    const report = expectJson(result, 2)
    const combinedOutput = `${result.stdout}${result.stderr}`

    expect(report.status).toBe('failed')
    expect(report.packages).toEqual([])
    expect(report.failures).toEqual([
      { code: 'INVALID_INPUT', message: 'Invalid package or option argument' }
    ])
    expect(packageManagerRan()).toBe(false)
    expect(combinedOutput).not.toContain('credential')
    expect(combinedOutput).not.toContain(rawUrl)
  })
})
