'use strict'

const mockIsCodingAgentEnvironment = jest.fn()
jest.mock('../lib/helpers/codingAgentEnvironment', () => ({
  isCodingAgentEnvironment: mockIsCodingAgentEnvironment
}))

const { CliParser } = require('../lib/cli')

describe('package-manager-aware minimal argument parsing', () => {
  let originalArgv
  let originalNPQPkgMgr

  beforeEach(() => {
    originalArgv = process.argv
    originalNPQPkgMgr = process.env.NPQ_PKG_MGR
    process.argv = ['node', 'npq-hero']
    delete process.env.NPQ_PKG_MGR
    mockIsCodingAgentEnvironment.mockReset()
    mockIsCodingAgentEnvironment.mockReturnValue(false)
  })

  afterEach(() => {
    process.argv = originalArgv
    if (originalNPQPkgMgr === undefined) {
      delete process.env.NPQ_PKG_MGR
    } else {
      process.env.NPQ_PKG_MGR = originalNPQPkgMgr
    }
  })

  const parseMinimal = ({ packageManager, args }) => {
    if (packageManager === undefined) {
      delete process.env.NPQ_PKG_MGR
    } else {
      process.env.NPQ_PKG_MGR = packageManager
    }
    process.argv = ['node', 'npq-hero', ...args]
    return CliParser.parseArgsMinimal()
  }

  test('finds an add command after a pnpm filter', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['--filter', 'workspace', 'add', 'express']
    })

    expect(result.packages).toEqual(['express@latest'])
  })

  test('excludes a trailing pnpm filter selector from packages', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['add', 'express', '--filter', 'workspace']
    })

    expect(result.packages).toEqual(['express@latest'])
  })

  test('excludes a pnpm filter between package operands', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['add', 'express', '--filter', 'workspace', 'lodash']
    })

    expect(result.packages).toEqual(['express@latest', 'lodash@latest'])
  })

  test.each([
    ['equals', ['--filter=workspace', 'add', 'express']],
    ['short', ['-F', 'workspace', 'add', 'express']]
  ])('supports the pnpm %s filter form', (_form, args) => {
    const result = parseMinimal({ packageManager: 'pnpm', args })

    expect(result.packages).toEqual(['express@latest'])
  })

  test('supports multiple pnpm filters', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: [
        '--filter',
        'workspace',
        '--filter',
        '@scope/*',
        '--filter-prod',
        'production',
        'add',
        'express'
      ]
    })

    expect(result.packages).toEqual(['express@latest'])
  })

  test.each(['workspace...', '...workspace'])('excludes the pnpm %s selector', (selector) => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['--filter', selector, 'add', 'express']
    })

    expect(result.packages).toEqual(['express@latest'])
  })

  test('does not treat a filter selector named install as the command', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['--filter', 'install', 'add', 'express']
    })

    expect(result.packages).toEqual(['express@latest'])
  })

  test('does not treat a pnpm selector after install as a package', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['install', '--filter', 'workspace...']
    })

    expect(result.packages).toEqual([])
  })

  test('keeps a package named install when it is an add operand', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['add', 'install', '--filter', 'workspace']
    })

    expect(result.packages).toEqual(['install@latest'])
  })

  test('keeps filtered non-install commands in passthrough mode', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: ['--filter', 'workspace', 'test']
    })

    expect(result.packages).toEqual([])
  })

  test.each([
    ['run', 'install'],
    ['exec', 'install']
  ])('does not inspect pnpm %s %s as an install command', (...args) => {
    const result = parseMinimal({ packageManager: 'pnpm', args })

    expect(result.packages).toEqual([])
  })

  test('composes pnpm filters with registry configuration', () => {
    const result = parseMinimal({
      packageManager: 'pnpm',
      args: [
        '--filter',
        'workspace',
        'add',
        '@company/tool',
        '--registry=https://registry.example.test/npm/',
        '--userconfig',
        '/tmp/user.npmrc',
        '--globalconfig=/tmp/global.npmrc'
      ]
    })

    expect(result).toEqual({
      packages: ['@company/tool@latest'],
      registryConfigArgs: [
        '--registry=https://registry.example.test/npm/',
        '--userconfig=/tmp/user.npmrc',
        '--globalconfig=/tmp/global.npmrc'
      ],
      installSubcommandExplicit: true,
      json: false
    })
  })

  test.each([
    ['default npm', undefined, ['install', 'express']],
    ['npm', 'npm', ['install', 'express']],
    ['yarn', 'yarn', ['add', 'express']]
  ])('preserves %s package parsing', (_label, packageManager, args) => {
    const result = parseMinimal({ packageManager, args })

    expect(result.packages).toEqual(['express@latest'])
  })

  test.each(['npm', 'yarn'])('does not apply the pnpm filter schema to %s', (packageManager) => {
    const result = parseMinimal({
      packageManager,
      args: ['--filter', 'workspace', 'add', 'express']
    })

    expect(result.packages).toEqual([])
  })
})
