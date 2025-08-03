const fs = require('fs')
const os = require('os')
const path = require('path')
const cliPrompt = require('../lib/helpers/cliPrompt.js')

const postinstall = require('../scripts/postinstall').testable
const preuninstall = require('../scripts/preuninstall').testable
const helpers = require('../scripts/scriptHelpers')

const TEST_PROFILE_PATH = path.resolve(os.tmpdir(), '.npq_test_profile')
const TEST_ALIAS = 'alias npm="npq-hero"'
cliPrompt.prompt = jest.fn().mockResolvedValue({ install: true })

let mockGetShellConfig
let mockIsRunningInYarn
let mockGetNpmVersion

const describeIf = (condition, ...args) => (condition ? describe(...args) : describe.skip(...args))

beforeEach(() => {
  mockGetShellConfig = jest.spyOn(helpers, 'getShellConfig').mockImplementation(() => ({
    name: 'testShell',
    profilePath: TEST_PROFILE_PATH,
    aliases: TEST_ALIAS
  }))
  // Our install script does not run when installing with yarn, but we still want to be able to run tests with yarn
  mockIsRunningInYarn = jest.spyOn(helpers, 'isRunningInYarn').mockImplementation(() => false)
  // Our install script does not run when installing with npm V7, but we still want to be able to run tests with all npm versions
  mockGetNpmVersion = jest.spyOn(helpers, 'getNpmVersion').mockImplementation(() => '6.0.0')
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

test('postinstall script does not run in yarn', async () => {
  // yarn does not allow for stdin input during `yarn global add npq`
  mockIsRunningInYarn.mockRestore()
  const oldExecPath = process.env.npm_execpath

  const spy = jest.spyOn(console, 'log')
  // pretend that we're running in yarn, whether or not we actually are
  process.env.npm_execpath = '/example/path/to/yarn.js'

  await postinstall.runPostInstall()
  expect(spy).not.toHaveBeenCalled()

  process.env.npm_execpath = oldExecPath
  spy.mockRestore()
})

test('postinstall script does not run in npm v7', async () => {
  // npm v7 does not allow for stdin input during `npm install [-g] npq`
  mockGetNpmVersion.mockRestore()
  const oldUserAgent = process.env.npm_config_user_agent

  const spy = jest.spyOn(console, 'log')
  // pretend that we're running in npm v7, whether or not we actually are
  process.env.npm_config_user_agent = 'npm/7.19.1 node/v14.16.1 win32 x64 workspaces/false'

  await postinstall.runPostInstall()
  expect(spy).not.toHaveBeenCalled()

  process.env.npm_config_user_agent = oldUserAgent
  spy.mockRestore()
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
  const containsDoubleAlias = await helpers.fileContains(
    TEST_PROFILE_PATH,
    `${TEST_ALIAS}${TEST_ALIAS}`
  )
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

  const profileExists = await fs.promises
    .access(TEST_PROFILE_PATH, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false)
  expect(profileExists).toBe(false)
})

describeIf(process.platform !== 'win32', 'getShellConfig', () => {
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
