const fs = require('fs')
const os = require('os')
const path = require('path')
const inquirer = require('inquirer')

const postinstall = require('../scripts/postinstall').testable
const preuninstall = require('../scripts/preuninstall').testable
const helpers = require('../scripts/scriptHelpers')

const TEST_PROFILE_PATH = path.resolve(os.tmpdir(), '.npq_test_profile')
const TEST_ALIAS = 'alias npm="npq-hero"'
inquirer.prompt = jest.fn().mockResolvedValue({ install: true })

let mockGetShellConfig

beforeEach(() => {
  mockGetShellConfig = jest.spyOn(helpers, 'getShellConfig').mockImplementation(() => ({ name: 'testShell', profilePath: TEST_PROFILE_PATH, aliases: TEST_ALIAS }))
})

afterEach(async () => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.promises.unlink(TEST_PROFILE_PATH)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return
    }
    throw err
  }
})

test('postinstall stops when detecting unknown shell', async () => {
  mockGetShellConfig.mockRestore()
  process.env.SHELL = '/usr/bin/fakeshell'

  await postinstall.runPostInstall()
  const containsAlias = await helpers.fileContains(TEST_PROFILE_PATH, TEST_ALIAS)
  expect(containsAlias).toBe(false)
})

test('postinstall script adds aliases', async () => {
  await postinstall.runPostInstall()

  const containsAlias = await helpers.fileContains(TEST_PROFILE_PATH, TEST_ALIAS)
  expect(containsAlias).toBe(true)
})

test('postinstall script does not create duplicate aliases', async () => {
  await postinstall.runPostInstall()
  await postinstall.runPostInstall()

  const containsAlias = await helpers.fileContains(TEST_PROFILE_PATH, TEST_ALIAS)
  const containsDoubleAlias = await helpers.fileContains(TEST_PROFILE_PATH, `${TEST_ALIAS}${TEST_ALIAS}`)
  expect(containsAlias).toBe(true)
  expect(containsDoubleAlias).toBe(false)
})

test('uninstall script removes aliases', async () => {
  await postinstall.runPostInstall()
  await preuninstall.runPreUninstall()

  const containsAlias = await helpers.fileContains(TEST_PROFILE_PATH, TEST_ALIAS)
  expect(containsAlias).toBe(false)
})

test('uninstall script does nothing in unknown shell', async () => {
  await postinstall.runPostInstall()

  mockGetShellConfig.mockRestore()
  process.env.SHELL = '/usr/bin/fakeshell'

  await preuninstall.runPreUninstall()
  const containsAlias = await helpers.fileContains(TEST_PROFILE_PATH, TEST_ALIAS)
  expect(containsAlias).toBe(true)
})

test('uninstall handles empty profile', async () => {
  await preuninstall.runPreUninstall()

  const profileExists = await fs.promises.access(TEST_PROFILE_PATH, fs.constants.F_OK).then(() => true).catch(() => false)
  expect(profileExists).toBe(false)
})

describe('getShellConfig', () => {
  test('detects bash', () => {
    mockGetShellConfig.mockRestore()
    process.env.SHELL = '/bin/bash'
    const { name } = helpers.getShellConfig()
    expect(name).toBe('bash')
  })

  test('detects zsh', () => {
    mockGetShellConfig.mockRestore()
    process.env.SHELL = '/usr/bin/zsh'
    const { name } = helpers.getShellConfig()
    expect(name).toBe('zsh')
  })
})
