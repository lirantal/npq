'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const RegistryConfig = require('../lib/helpers/registryConfig')

describe('RegistryConfig', () => {
  let root
  let project
  let home
  let userConfig
  let globalConfig
  let env

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'npq-registry-config-'))
    project = path.join(root, 'project')
    home = path.join(root, 'home')
    userConfig = path.join(root, 'user.npmrc')
    globalConfig = path.join(root, 'global.npmrc')
    fs.mkdirSync(project)
    fs.mkdirSync(home)
    fs.writeFileSync(path.join(project, 'package.json'), '{"name":"fixture"}')
    fs.writeFileSync(
      globalConfig,
      'registry=https://global.example.test/npm/\n'
    )
    fs.writeFileSync(
      userConfig,
      [
        'registry=https://user.example.test/npm/',
        '//basic.example.test/npm/:username=ci-user',
        `//basic.example.test/npm/:_password=${Buffer.from('ci-password').toString('base64')}`
      ].join('\n')
    )
    fs.writeFileSync(
      path.join(project, '.npmrc'),
      [
        'registry=https://project.example.test/npm/',
        '@company:registry=https://scope.example.test/artifactory/api/npm/company/',
        '//scope.example.test/artifactory/api/npm/company/:_authToken=scope-token'
      ].join('\n')
    )
    env = {
      ...process.env,
      HOME: home,
      npm_config_userconfig: userConfig,
      npm_config_globalconfig: globalConfig
    }
    delete env.npm_config_registry
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  test('uses CLI registry while preserving project scoped registries and auth', async () => {
    const config = await RegistryConfig.load({
      argv: ['--registry=https://cli.example.test/npm/'],
      env,
      cwd: project
    })

    expect(config.registryFor('left-pad')).toBe(
      'https://cli.example.test/npm/'
    )
    expect(config.registryFor('@company/tool')).toBe(
      'https://scope.example.test/artifactory/api/npm/company/'
    )
    expect(
      config.requestOptions[
        '//scope.example.test/artifactory/api/npm/company/:_authToken'
      ]
    ).toBe('scope-token')
    expect(config.describeRegistry('@company/tool')).not.toContain(
      'scope-token'
    )
  })

  test('uses environment over project and project over user and global', async () => {
    const environmentConfig = await RegistryConfig.load({
      env: {
        ...env,
        npm_config_registry: 'https://environment.example.test/npm/'
      },
      cwd: project
    })
    const projectConfig = await RegistryConfig.load({ env, cwd: project })

    expect(environmentConfig.registryFor('left-pad')).toBe(
      'https://environment.example.test/npm/'
    )
    expect(projectConfig.registryFor('left-pad')).toBe(
      'https://project.example.test/npm/'
    )
  })

  test('preserves registry scoped basic authentication fields', async () => {
    const config = await RegistryConfig.load({ env, cwd: project })

    expect(
      config.requestOptions['//basic.example.test/npm/:username']
    ).toBe('ci-user')
    expect(
      config.requestOptions['//basic.example.test/npm/:_password']
    ).toBe(Buffer.from('ci-password').toString('base64'))
  })

  test('flattens CA, proxy, TLS, and registry-scoped client certificate options', async () => {
    const caFile = path.join(root, 'company-ca.pem')
    const certFile = path.join(root, 'client-cert.pem')
    const keyFile = path.join(root, 'client-key.pem')
    fs.writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nCOMPANY CA\n-----END CERTIFICATE-----\n'
    )
    fs.writeFileSync(certFile, 'CLIENT CERTIFICATE')
    fs.writeFileSync(keyFile, 'CLIENT KEY')
    fs.writeFileSync(
      path.join(project, '.npmrc'),
      [
        'registry=https://secure.example.test/npm/',
        `cafile=${caFile}`,
        'strict-ssl=true',
        'https-proxy=https://proxy.example.test:8443/',
        `//secure.example.test/npm/:certfile=${certFile}`,
        `//secure.example.test/npm/:keyfile=${keyFile}`
      ].join('\n')
    )

    const config = await RegistryConfig.load({ env, cwd: project })

    expect(config.requestOptions.ca.join('\n')).toContain('COMPANY CA')
    expect(config.requestOptions.httpsProxy).toBe(
      'https://proxy.example.test:8443/'
    )
    expect(config.requestOptions.strictSSL).toBe(true)
    expect(
      config.requestOptions['//secure.example.test/npm/:certfile']
    ).toBe(certFile)
    expect(config.requestOptions['//secure.example.test/npm/:keyfile']).toBe(
      keyFile
    )
  })

  test('provides public npm defaults without reading config files', () => {
    const config = RegistryConfig.defaults()

    expect(config.requestOptions.registry).toBe(
      'https://registry.npmjs.org/'
    )
    expect(config.registryFor('left-pad')).toBe(
      'https://registry.npmjs.org/'
    )
  })

  test('normalizes registries without trailing slashes', () => {
    const config = new RegistryConfig({
      registry: 'https://registry.example.test/npm'
    })

    expect(config.registryFor('left-pad')).toBe(
      'https://registry.example.test/npm/'
    )
  })

  test('reports invalid registry URLs as configuration errors', async () => {
    await expect(
      RegistryConfig.load({
        argv: ['--registry=not a registry url'],
        env,
        cwd: project
      })
    ).rejects.toMatchObject({
      name: 'RegistryError',
      code: 'EREGISTRYCONFIG'
    })
  })

  test('reports invalid unscoped authentication as a safe config error', async () => {
    fs.writeFileSync(path.join(project, '.npmrc'), '_authToken=secret-value\n')

    await expect(
      RegistryConfig.load({ env, cwd: project })
    ).rejects.toMatchObject({
      name: 'RegistryError',
      code: 'EREGISTRYCONFIGAUTH',
      message: expect.not.stringContaining('secret-value')
    })
  })
})
