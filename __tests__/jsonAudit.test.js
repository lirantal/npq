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
        promiseThrottleHelper
      })
    )
    expect(report.status).toBe('clean')
    expect(report.packages).toEqual([{ requested: 'express@^5.0.0', findings: [] }])
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
