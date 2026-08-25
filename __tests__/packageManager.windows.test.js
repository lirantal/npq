'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const packageManager = require('../lib/packageManager')

const originalArgv = process.argv
const temporaryDirectories = []

afterAll(() => {
  process.argv = originalArgv

  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

const describeWindows = process.platform === 'win32' ? describe : describe.skip

describeWindows('Windows package-manager launching', () => {
  test('forwards metacharacters through a real cmd shim as literal arguments', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'npq-package-manager-'))
    temporaryDirectories.push(directory)

    const markerPath = path.join(directory, 'arguments.json')
    const capturePath = path.join(directory, 'capture.js')
    const launcherPath = path.join(directory, 'package-manager.cmd')

    fs.writeFileSync(
      capturePath,
      [
        "'use strict'",
        "const fs = require('node:fs')",
        `const markerPath = ${JSON.stringify(markerPath)}`,
        'fs.writeFileSync(markerPath, JSON.stringify(process.argv.slice(2)))',
        ''
      ].join('\r\n')
    )

    fs.writeFileSync(
      launcherPath,
      ['@echo off', `"${process.execPath}" "%~dp0capture.js" %*`, ''].join('\r\n')
    )

    process.argv = [
      'node',
      'npq',
      'install',
      'safe&value',
      'safe|value',
      '(grouped)',
      'quoted value',
      '100%literal'
    ]

    const exitCode = await packageManager.process(launcherPath)

    expect(exitCode).toBe(0)
    expect(JSON.parse(fs.readFileSync(markerPath, 'utf8'))).toEqual([
      'install',
      'safe&value',
      'safe|value',
      '(grouped)',
      'quoted value',
      '100%literal'
    ])
  })
})
