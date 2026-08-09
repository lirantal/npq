'use strict'

/* eslint-disable security/detect-non-literal-fs-filename -- paths stay inside per-test temp dirs */

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Ajv2020 = require('ajv/dist/2020')
const schema = require('../schema/npq-output-v1.schema.json')

const root = path.resolve(__dirname, '..')
const binary = path.join(root, 'bin/npq.js')
const preload = path.join(__dirname, '__fixtures__/json-process-preload.js')
const validate = new Ajv2020().compile(schema)
let fixtureDirectory
let packageManagerMarker

function writeProject(packageJson = {}) {
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'npq-json-process-'))
  packageManagerMarker = path.join(fixtureDirectory, 'package-manager-ran')
  fs.writeFileSync(path.join(fixtureDirectory, 'package.json'), JSON.stringify(packageJson))
}

function childEnvironment(scenario, extra = {}) {
  return {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require=${preload}`.trim(),
    NPQ_JSON_TEST_SCENARIO: scenario,
    NPQ_PKG_MGR: `node -e "require('node:fs').writeFileSync('${packageManagerMarker}', 'ran')"`,
    ...extra
  }
}

function runJson(args, { scenario = 'clean', env = {} } = {}) {
  return spawnSync(process.execPath, [binary, ...args], {
    cwd: fixtureDirectory,
    env: childEnvironment(scenario, env),
    encoding: 'utf8',
    timeout: 10000
  })
}

function expectJsonDocument(result, expectedExitCode) {
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(expectedExitCode)
  expect(result.stderr).toBe('')
  expect(result.stdout.endsWith('\n')).toBe(true)
  const report = JSON.parse(result.stdout)
  expect(result.stdout).toBe(`${JSON.stringify(report)}\n`)
  expect(validate(report)).toBe(true)
  expect(report.summary.packagesAudited).toBe(report.packages.length)
  expect(report.summary.errors).toBe(
    report.packages.flatMap((entry) => entry.findings).filter((item) => item.severity === 'error')
      .length
  )
  expect(report.summary.warnings).toBe(
    report.packages.flatMap((entry) => entry.findings).filter((item) => item.severity === 'warning')
      .length
  )
  expect(fs.existsSync(packageManagerMarker)).toBe(false)
  return report
}

afterEach(() => {
  if (fixtureDirectory) fs.rmSync(fixtureDirectory, { recursive: true, force: true })
  fixtureDirectory = undefined
})

describe('shipped npq JSON process contract', () => {
  test('writes a clean report for an empty project and exits zero', () => {
    writeProject({ name: 'empty-project', version: '1.0.0' })

    const report = expectJsonDocument(runJson(['--json']), 0)

    expect(report.status).toBe('clean')
    expect(report.summary).toEqual({ packagesAudited: 0, errors: 0, warnings: 0 })
    expect(report.failures).toEqual([])
  })

  test.each([
    'https://user:credential@example.test/package.tgz',
    'git+https://user:credential@example.test/repository.git',
    'file:/private/project/package.tgz',
    'alias-name@npm:express@1.0.0'
  ])('safely rejects unsupported CLI spec %s', (packageSpec) => {
    writeProject({ name: 'invalid-input-project' })

    const result = runJson(['install', packageSpec, '--json'])
    const report = expectJsonDocument(result, 2)
    const allOutput = `${result.stdout}${result.stderr}`

    expect(report.status).toBe('failed')
    expect(report.packages).toEqual([])
    expect(report.failures).toEqual([
      { code: 'INVALID_INPUT', message: 'Invalid package or option argument' }
    ])
    expect(allOutput).not.toContain('credential')
    expect(allOutput).not.toContain('/private/project')
  })

  test('safely rejects an unsupported project dependency before marshall construction', () => {
    writeProject({
      name: 'unsafe-project',
      dependencies: {
        unsafe: 'https://user:credential@example.test/private/package.tgz'
      }
    })

    const result = runJson(['--json'])
    const report = expectJsonDocument(result, 2)

    expect(report.packages).toEqual([])
    expect(report.failures).toEqual([
      { code: 'INVALID_INPUT', message: 'Invalid package or option argument' }
    ])
    expect(`${result.stdout}${result.stderr}`).not.toContain('credential')
    expect(`${result.stdout}${result.stderr}`).not.toContain('/private/package.tgz')
  })

  test('writes findings with exit one', () => {
    writeProject({ name: 'findings-project' })

    const report = expectJsonDocument(
      runJson(['install', '@scope/example@1.0.0', '--json'], { scenario: 'findings' }),
      1
    )

    expect(report.status).toBe('findings')
    expect(report.summary).toEqual({ packagesAudited: 1, errors: 1, warnings: 0 })
    expect(report.packages[0].requested).toBe('@scope/example@1.0.0')
  })

  test('writes a safe operational failure with exit two', () => {
    writeProject({ name: 'failure-project' })

    const report = expectJsonDocument(
      runJson(['install', 'express', '--json'], { scenario: 'failure' }),
      2
    )

    expect(report.status).toBe('failed')
    expect(report.failures).toEqual([
      {
        code: 'PACKAGE_LOOKUP_FAILED',
        message: 'Unable to retrieve package metadata',
        package: 'express@latest'
      }
    ])
  })

  test('suppresses marshall debug output with NODE_DEBUG=npq', () => {
    writeProject({ name: 'debug-project' })

    const report = expectJsonDocument(
      runJson(['express', '--json'], {
        scenario: 'debug',
        env: { NODE_DEBUG: 'npq' }
      }),
      0
    )

    expect(report.status).toBe('clean')
  })

  test.each([['--help', 'Usage: npq install'], ['--version', '0.0.0-development']])(
    'keeps %s as a text-only early exit',
    (option, expectedText) => {
      writeProject({ name: 'text-project' })

      const result = runJson(['--json', option])

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain(expectedText)
      expect(() => JSON.parse(result.stdout)).toThrow()
      expect(fs.existsSync(packageManagerMarker)).toBe(false)
    }
  )

  test('ignores human-output flags and explicit install while remaining audit-only', () => {
    writeProject({ name: 'ignored-flags-project' })

    const report = expectJsonDocument(
      runJson([
        'install',
        'express',
        '--json',
        '--dry-run',
        '--plain',
        '--disable-auto-continue',
        '--packageManager',
        'definitely-not-a-package-manager'
      ]),
      0
    )

    expect(report.status).toBe('clean')
    expect(report.packages).toHaveLength(1)
  })

  test('drains a large piped interruption report before exiting two', async () => {
    writeProject({ name: 'sigint-project' })
    const packageCount = 5000
    const args = [binary, 'install', ...Array(packageCount).fill('duplicate'), '--json']
    const child = spawn(process.execPath, args, {
      cwd: fixtureDirectory,
      env: childEnvironment('sigint'),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error('Timed out waiting for SIGINT process contract'))
      }, 10000)
      child.once('error', reject)
      child.once('message', () => child.kill('SIGINT'))
      child.once('close', (code, signal) => {
        clearTimeout(timeout)
        resolve({ code, signal })
      })
    })

    expect(result).toEqual({ code: 2, signal: null })
    expect(stderr).toBe('')
    expect(stdout.endsWith('\n')).toBe(true)
    const report = JSON.parse(stdout)
    expect(stdout).toBe(`${JSON.stringify(report)}\n`)
    expect(validate(report)).toBe(true)
    expect(report.status).toBe('failed')
    expect(report.summary).toEqual({ packagesAudited: packageCount, errors: 0, warnings: 0 })
    expect(report.packages).toHaveLength(packageCount)
    expect(report.failures).toEqual([
      { code: 'INTERRUPTED', message: 'Audit interrupted' }
    ])
    expect(fs.existsSync(packageManagerMarker)).toBe(false)
  })
})
