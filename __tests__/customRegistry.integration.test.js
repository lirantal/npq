'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Marshall = require('../lib/marshall')
const Marshalls = require('../lib/marshalls')
const NpmRegistry = require('../lib/helpers/npmRegistry')
const RegistryConfig = require('../lib/helpers/registryConfig')
const RegistryClient = require('../lib/helpers/registryClient')

const registryMarshalls = [
  path.join(process.cwd(), 'lib/marshalls/signatures.marshall.js'),
  path.join(process.cwd(), 'lib/marshalls/provenance.marshall.js'),
  path.join(process.cwd(), 'lib/marshalls/downloads.marshall.js')
]

function responseFor(requestPath, options) {
  const packageName = options.spec
  if (requestPath === '-/npm/v1/keys') {
    return { keys: [{ keyid: 'key-1', key: 'PUBLICKEY' }] }
  }
  if (requestPath.startsWith('-/npm/v1/attestations/')) {
    return { attestations: [{ bundle: {} }] }
  }

  return {
    name: packageName,
    'dist-tags': { latest: '1.0.0' },
    versions: {
      '1.0.0': {
        name: packageName,
        version: '1.0.0',
        dist: {
          integrity: 'sha512-example',
          signatures: [{ keyid: 'key-1', sig: 'signature' }],
          attestations: {
            url: `https://registry.npmjs.org/-/npm/v1/attestations/${packageName}@1.0.0`
          }
        }
      }
    }
  }
}

describe('authenticated custom registry audits', () => {
  let root
  let project
  let home
  let userConfig
  let globalConfig
  let env

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'npq-custom-registry-'))
    project = path.join(root, 'project')
    home = path.join(root, 'home')
    userConfig = path.join(root, 'user.npmrc')
    globalConfig = path.join(root, 'global.npmrc')
    fs.mkdirSync(project)
    fs.mkdirSync(home)
    fs.writeFileSync(path.join(project, 'package.json'), '{"name":"fixture"}')
    fs.writeFileSync(userConfig, '')
    fs.writeFileSync(globalConfig, '')
    fs.writeFileSync(
      path.join(project, '.npmrc'),
      [
        'registry=https://artifactory.example.test/artifactory/api/npm/npm/',
        '@company:registry=https://artifactory.example.test/artifactory/api/npm/company/',
        '//artifactory.example.test/artifactory/api/npm/:_authToken=${ARTIFACTORY_TOKEN}',
        'strict-ssl=true'
      ].join('\n')
    )
    env = {
      ...process.env,
      HOME: home,
      ARTIFACTORY_TOKEN: 'integration-secret',
      npm_config_userconfig: userConfig,
      npm_config_globalconfig: globalConfig
    }
    jest.spyOn(Marshalls, 'collectMarshalls').mockResolvedValue(registryMarshalls)
    jest
      .spyOn(NpmRegistry.prototype, 'verifySignatures')
      .mockResolvedValue({ _signatures: [{}] })
    jest
      .spyOn(NpmRegistry.prototype, 'verifyAttestations')
      .mockResolvedValue({ _attestations: {} })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  async function createAudit(transportImplementation = responseFor) {
    const config = await RegistryConfig.load({ argv: [], env, cwd: project })
    const calls = []
    const fetcher = {
      json: jest.fn(async (requestPath, options) => {
        const registry = config.registryFor(options.spec)
        const url = new URL(requestPath, registry).toString()
        calls.push({ url, requestPath, options })
        return transportImplementation(requestPath, options)
      })
    }
    const registryClient = new RegistryClient(config, { fetcher })
    const marshall = new Marshall({
      pkgs: [['unscoped-tool@1.0.0', '@company/tool@1.0.0']],
      registryClient
    })
    return { calls, config, fetcher, marshall, registryClient }
  }

  test('routes metadata, keys, and attestations without public-registry fallback', async () => {
    const { calls, marshall } = await createAudit()

    const results = await marshall.process()

    expect(results).toBeDefined()
    expect(calls.every(({ url }) => !url.includes('registry.npmjs.org'))).toBe(true)
    expect(calls.every(({ url }) => !url.includes('api.npmjs.org'))).toBe(true)
    expect(
      calls.every(
        ({ options }) =>
          options['//artifactory.example.test/artifactory/api/npm/:_authToken'] ===
          'integration-secret'
      )
    ).toBe(true)
    expect(
      calls.some(({ url }) =>
        url.startsWith(
          'https://artifactory.example.test/artifactory/api/npm/company/@company%2ftool'
        )
      )
    ).toBe(true)
    expect(
      calls.some(({ url }) =>
        url.startsWith(
          'https://artifactory.example.test/artifactory/api/npm/company/-/npm/v1/attestations/'
        )
      )
    ).toBe(true)
    expect(JSON.stringify(results)).not.toContain('integration-secret')
  })

  test('reports one cached signing-key capability skip and no download requests', async () => {
    const missing = Object.assign(new Error('not found'), { statusCode: 404 })
    const { calls, marshall } = await createAudit((requestPath, options) => {
      if (requestPath === '-/npm/v1/keys') {
        throw missing
      }
      return responseFor(requestPath, options)
    })

    const results = await marshall.process()
    const auditResults = Object.values(results)[0]
    const signingKeyCalls = calls.filter(
      ({ requestPath }) => requestPath === '-/npm/v1/keys'
    )

    expect(signingKeyCalls).toHaveLength(2)
    expect(auditResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signatures: expect.objectContaining({
            errors: [],
            warnings: [],
            notEvaluated: expect.arrayContaining([
              expect.objectContaining({
                message: 'configured registry does not expose signing keys'
              })
            ])
          })
        }),
        expect.objectContaining({
          downloads: expect.objectContaining({
            errors: [],
            warnings: [],
            notEvaluated: expect.arrayContaining([
              expect.objectContaining({
                message: 'download counts are available only for the public npm registry'
              })
            ])
          })
        })
      ])
    )
    expect(calls.some(({ url }) => url.includes('api.npmjs.org'))).toBe(false)
  })

  test.each([
    ['metadata authentication failure', '@company%2ftool', 401, 'EREGISTRYAUTH'],
    ['signing-key server failure', '-/npm/v1/keys', 500, 'EREGISTRYHTTP']
  ])('rejects the audit on %s', async (_name, failingPath, statusCode, code) => {
    const failure = Object.assign(new Error('transport detail'), { statusCode })
    const { marshall } = await createAudit((requestPath, options) => {
      if (requestPath === failingPath) {
        throw failure
      }
      return responseFor(requestPath, options)
    })

    await expect(marshall.process()).rejects.toMatchObject({
      name: 'RegistryError',
      code,
      message: expect.not.stringContaining('integration-secret')
    })
  })

  test.each([
    ['malformed signing keys', '-/npm/v1/keys', { invalid: true }],
    [
      'malformed attestations',
      '-/npm/v1/attestations/',
      { invalid: true }
    ]
  ])('rejects the audit on %s', async (_name, failingPath, response) => {
    const { marshall } = await createAudit((requestPath, options) => {
      if (requestPath.startsWith(failingPath)) {
        return response
      }
      return responseFor(requestPath, options)
    })

    await expect(marshall.process()).rejects.toMatchObject({
      name: 'RegistryError',
      code: 'EREGISTRYPROTOCOL'
    })
  })
})
