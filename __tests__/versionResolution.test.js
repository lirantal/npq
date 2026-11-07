'use strict'

const BaseMarshall = require('../lib/marshalls/baseMarshall')
const ScriptsMarshall = require('../lib/marshalls/scripts.marshall')
const PackageRepoUtils = require('../lib/helpers/packageRepoUtils')
const RegistryClient = require('../lib/helpers/registryClient')
const RegistryConfig = require('../lib/helpers/registryConfig')
const { getInstallAction } = require('../lib/helpers/installPolicy')

function fixture(tags = { latest: '2.1.0', '2.x': '2.0.0' }) {
  return {
    name: 'resolution-fixture',
    'dist-tags': tags,
    versions: {
      '2.0.0': { name: 'resolution-fixture', version: '2.0.0' },
      '2.1.0': {
        name: 'resolution-fixture',
        version: '2.1.0',
        scripts: { postinstall: 'node fixture.js' }
      }
    }
  }
}

function setup(data, options = {}) {
  const registryClient = new RegistryClient(new RegistryConfig(options))
  registryClient.getPackageInfo = jest.fn().mockResolvedValue(data)
  const packageRepoUtils = new PackageRepoUtils({ registryClient })
  return {
    registryClient,
    packageRepoUtils,
    base: new BaseMarshall({ registryClient, packageRepoUtils }),
    scripts: new ScriptsMarshall({ registryClient, packageRepoUtils })
  }
}

describe('shared npm version selection', () => {
  test.each(['2.x', '^2.0.0', '~2.1.0', '2', 'v2'])(
    '%s ignores a range-shaped dist-tag',
    async (spec) => {
      const data = fixture({ latest: '2.1.0', [spec]: '2.0.0' })
      const { base, packageRepoUtils, registryClient } = setup(data)
      await expect(base.resolvePackageVersion(data.name, spec, data)).resolves.toBe('2.1.0')
      await expect(packageRepoUtils.getSemVer(data.name, spec)).resolves.toBe('2.1.0')
      await expect(registryClient.getManifest(`${data.name}@${spec}`, data)).resolves.toMatchObject(
        { version: '2.1.0' }
      )
    }
  )

  test('exact versions ignore version-shaped tags', async () => {
    const data = fixture({ latest: '2.1.0', '2.1.0': '2.0.0' })
    const { base } = setup(data)
    await expect(base.resolvePackageVersion(data.name, '2.1.0', data)).resolves.toBe('2.1.0')
  })

  test('a satisfying latest is preferred to the highest version', async () => {
    const data = fixture({ latest: '2.0.0' })
    const { base, packageRepoUtils } = setup(data)
    await expect(base.resolvePackageVersion(data.name, '2.x', data)).resolves.toBe('2.0.0')
    await expect(packageRepoUtils.getSemVer(data.name, '2.x')).resolves.toBe('2.0.0')
  })

  test.each(['shadow', 'ordinary-latest'])(
    '%s cannot hide a lifecycle-script finding',
    async (scenario) => {
      const data = fixture()
      if (scenario === 'ordinary-latest') {
        data['dist-tags'] = { latest: '2.0.0' }
        data.versions['2.0.0'].scripts = data.versions['2.1.0'].scripts
        delete data.versions['2.1.0'].scripts
      }
      const { scripts } = setup(data)
      const pkg = {
        packageName: data.name,
        packageVersion: '2.x',
        packageString: `${data.name}@2.x`
      }
      const ctx = { pkgs: [pkg], marshalls: {} }
      scripts.init(ctx)
      await scripts.run(ctx)
      expect(ctx.marshalls.scripts.errors).toEqual([
        expect.objectContaining({ message: expect.stringContaining('postinstall') })
      ])
      expect(
        getInstallAction({
          countErrors: ctx.marshalls.scripts.errors.length,
          allowNonInteractiveInstall: true
        })
      ).toBe('reject')
    }
  )

  test.each(['3.x', 'missing-tag', '2.9.0', '^99.0.0'])(
    'unresolved %s is an audit failure',
    async (spec) => {
      const data = fixture()
      const { base, packageRepoUtils, registryClient } = setup(data)
      await expect(base.resolvePackageVersion(data.name, spec, data)).rejects.toMatchObject({
        code: 'EREGISTRYRESOLVE'
      })
      await expect(packageRepoUtils.getSemVer(data.name, spec)).rejects.toMatchObject({
        code: 'EREGISTRYRESOLVE'
      })
      await expect(registryClient.getManifest(`${data.name}@${spec}`, data)).rejects.toMatchObject({
        code: 'EREGISTRYRESOLVE'
      })
    }
  )

  test('missing versions and dangling tags cannot pass as an audited manifest', async () => {
    for (const data of [
      { name: 'pkg', 'dist-tags': { latest: '1.0.0' } },
      { name: 'pkg', versions: {}, 'dist-tags': { latest: '1.0.0' } }
    ]) {
      const { base } = setup(data)
      await expect(base.resolvePackageVersion('pkg', 'latest', data)).rejects.toMatchObject({
        code: 'EREGISTRYRESOLVE'
      })
    }
  })

  test.each([
    ['beta', { defaultTag: 'beta' }, { latest: '2.1.0', beta: '2.0.0' }, '2.0.0'],
    ['*', { defaultTag: 'beta' }, { latest: '2.1.0', beta: '2.0.0' }, '2.0.0'],
    ['2.x', { before: '2025-02-01' }, { latest: '2.1.0' }, '2.0.0'],
    ['2.x', {}, { latest: '3.0.0' }, '2.1.0'],
    ['v2.0.0', {}, { latest: '2.1.0' }, '2.0.0']
  ])('resolves %s with npm preferences %j', async (spec, options, tags, expected) => {
    const data = fixture(tags)
    data.time = { '2.0.0': '2025-01-01', '2.1.0': '2025-03-01' }
    const { base, packageRepoUtils, registryClient } = setup(data, options)
    await expect(base.resolvePackageVersion(data.name, spec, data)).resolves.toBe(expected)
    await expect(packageRepoUtils.getSemVer(data.name, spec)).resolves.toBe(expected)
    await expect(registryClient.getManifest(`${data.name}@${spec}`, data)).resolves.toMatchObject({
      version: expected
    })
  })

  test('range selection skips a deprecated latest and excludes prereleases', async () => {
    const data = fixture({ latest: '2.0.0' })
    data.versions['2.0.0'].deprecated = 'obsolete'
    data.versions['2.2.0-beta.1'] = { name: data.name, version: '2.2.0-beta.1' }
    const { base } = setup(data)
    await expect(base.resolvePackageVersion(data.name, '2.x', data)).resolves.toBe('2.1.0')
    await expect(base.resolvePackageVersion(data.name, '*', data)).resolves.toBe('2.1.0')
    await expect(base.resolvePackageVersion(data.name, 'latest', data)).resolves.toBe('2.0.0')
    await expect(base.resolvePackageVersion(data.name, '2.2.0-beta.1', data)).resolves.toBe(
      '2.2.0-beta.1'
    )
  })

  test('manifest selection does not mutate cached bin metadata', async () => {
    const data = fixture()
    data.versions['2.1.0'].bin = './cli.js'
    const before = structuredClone(data)
    const { registryClient } = setup(data)
    await registryClient.getManifest(`${data.name}@2.x`, data)
    expect(data).toEqual(before)
  })

  test('rejects a selected manifest without a version', async () => {
    const data = fixture()
    delete data.versions['2.1.0'].version
    const { base } = setup(data)
    await expect(base.resolvePackageVersion(data.name, '2.x', data)).rejects.toMatchObject({
      code: 'EREGISTRYRESOLVE'
    })
  })

  test.each([null, '', 'file:./local', 'https://example.com/pkg.tgz'])(
    'rejects unsupported or empty spec %s',
    async (spec) => {
      const data = fixture()
      const { base } = setup(data)
      await expect(base.resolvePackageVersion(data.name, spec, data)).rejects.toMatchObject({
        code: 'EREGISTRYRESOLVE'
      })
    }
  )
})
