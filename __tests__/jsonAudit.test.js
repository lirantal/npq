'use strict'

const { runJsonAudit } = require('../lib/jsonAudit')
const { AUDIT_FAILURE_CODES, createAuditFailure } = require('../lib/helpers/auditFailure')

describe('runJsonAudit', () => {
  test('discovers project dependencies when no packages were requested', async () => {
    const getProjectPackages = jest.fn().mockResolvedValue(['express@^5.0.0'])
    const process = jest.fn().mockResolvedValue({ 'express@^5.0.0': [] })
    const Marshall = jest.fn().mockImplementation((options) => ({ process, options }))
    const promiseThrottleHelper = jest.fn()

    const report = await runJsonAudit(
      { packages: [] },
      { getProjectPackages, Marshall, promiseThrottleHelper }
    )

    expect(getProjectPackages).toHaveBeenCalledTimes(1)
    expect(Marshall).toHaveBeenCalledWith(
      expect.objectContaining({
        pkgs: ['express@^5.0.0'],
        progressManager: null,
        promiseThrottleHelper,
        preserveRequestOrder: true,
        suppressOutput: true
      })
    )
    expect(report.status).toBe('clean')
    expect(report.packages).toEqual([{ requested: 'express@^5.0.0', findings: [] }])
  })

  test('loads and injects registry configuration for JSON audits', async () => {
    const registryConfig = { requestOptions: { registry: 'https://registry.example.test/' } }
    const registryClient = { registryFor: jest.fn() }
    const RegistryConfig = {
      load: jest.fn().mockResolvedValue(registryConfig)
    }
    const RegistryClient = jest.fn().mockReturnValue(registryClient)
    const Marshall = jest.fn().mockImplementation(() => ({
      process: jest.fn().mockResolvedValue([[]])
    }))

    await runJsonAudit(
      {
        packages: ['@company/tool@latest'],
        registryConfigArgs: ['--registry=https://registry.example.test/']
      },
      { Marshall, RegistryConfig, RegistryClient }
    )

    expect(RegistryConfig.load).toHaveBeenCalledWith({
      argv: ['--registry=https://registry.example.test/']
    })
    expect(RegistryClient).toHaveBeenCalledWith(registryConfig)
    expect(Marshall).toHaveBeenCalledWith(
      expect.objectContaining({
        registryClient
      })
    )
  })

  test('returns a safe project manifest failure without exposing its raw path', async () => {
    const getProjectPackages = jest
      .fn()
      .mockResolvedValue({ error: true, message: 'No package.json found in /secret/path' })
    const Marshall = jest.fn()

    const report = await runJsonAudit({ packages: [] }, { getProjectPackages, Marshall })

    expect(Marshall).not.toHaveBeenCalled()
    expect(report.failures).toEqual([
      {
        code: AUDIT_FAILURE_CODES.PROJECT_MANIFEST_ERROR,
        message: 'Unable to read project package.json'
      }
    ])
    expect(JSON.stringify(report)).not.toContain('/secret/path')
  })

  test.each([
    ['tarball URL', 'unsafe@https://user:credential@example.test/package.tgz'],
    ['git URL', 'unsafe@git+https://user:credential@example.test/repository.git'],
    ['file path', 'unsafe@file:/private/project/package.tgz'],
    ['directory', 'unsafe@../private/project'],
    ['alias', 'unsafe@npm:express@1.0.0']
  ])('rejects a project dependency using a %s without exposing it', async (label, packageSpec) => {
    const getProjectPackages = jest.fn().mockResolvedValue([packageSpec])
    const Marshall = jest.fn()

    const report = await runJsonAudit({ packages: [] }, { getProjectPackages, Marshall })
    const serialized = JSON.stringify(report)

    expect(Marshall).not.toHaveBeenCalled()
    expect(report.status).toBe('failed')
    expect(report.summary).toEqual({ packagesAudited: 0, errors: 0, warnings: 0 })
    expect(report.packages).toEqual([])
    expect(report.failures).toEqual([
      {
        code: AUDIT_FAILURE_CODES.INVALID_INPUT,
        message: 'Invalid package or option argument'
      }
    ])
    expect(serialized).not.toContain('credential')
    expect(serialized).not.toContain('/private/project')
    expect(serialized).not.toContain('../private/project')
  })

  test('keeps duplicate package audit attempts aligned with their own findings', async () => {
    const first = {
      age: {
        marshall: 'age',
        categoryId: 'PackageHealth',
        warnings: [{ message: 'first attempt' }],
        errors: []
      }
    }
    const second = {
      scripts: {
        marshall: 'scripts',
        categoryId: 'SupplyChainSecurity',
        warnings: [],
        errors: [{ message: 'second attempt' }]
      }
    }
    const Marshall = jest.fn().mockImplementation(() => ({
      process: jest.fn().mockResolvedValue([[first], [second]])
    }))

    const report = await runJsonAudit(
      { packages: ['duplicate@1.0.0', 'duplicate@1.0.0'] },
      { Marshall }
    )

    expect(
      report.packages.map((entry) => entry.findings.map((finding) => finding.message))
    ).toEqual([['first attempt'], ['second attempt']])
    expect(report.summary).toEqual({ packagesAudited: 2, errors: 1, warnings: 1 })
  })

  test('collects callback failures alongside partial audit results', async () => {
    const callbackFailure = createAuditFailure(
      AUDIT_FAILURE_CODES.AUDIT_CHECK_FAILED,
      'Repository audit unavailable',
      { package: 'express@latest', marshall: 'repo' }
    )
    const Marshall = jest.fn().mockImplementation((options) => ({
      async process() {
        options.onAuditFailure(callbackFailure)
        return {
          'express@latest': [
            {
              age: {
                marshall: 'age',
                categoryId: 'PackageHealth',
                warnings: [{ message: 'Published recently' }],
                errors: []
              }
            }
          ]
        }
      }
    }))

    const report = await runJsonAudit({ packages: ['express@latest'] }, { Marshall })

    expect(report.status).toBe('failed')
    expect(report.summary.warnings).toBe(1)
    expect(report.packages[0].findings).toHaveLength(1)
    expect(report.failures).toEqual([callbackFailure])
  })

  test('maps unexpected exceptions to a safe internal failure', async () => {
    const Marshall = jest.fn().mockImplementation(() => ({
      process: jest.fn().mockRejectedValue(new Error('token at /secret/path'))
    }))

    const report = await runJsonAudit({ packages: ['express@latest'] }, { Marshall })

    expect(report.failures).toEqual([
      {
        code: AUDIT_FAILURE_CODES.INTERNAL_ERROR,
        message: 'JSON audit could not complete'
      }
    ])
    expect(JSON.stringify(report)).not.toContain('token')
    expect(JSON.stringify(report)).not.toContain('/secret/path')
  })
})
