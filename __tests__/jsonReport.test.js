'use strict'

const Ajv2020 = require('ajv/dist/2020')
const schema = require('../schema/npq-output-v1.schema.json')
const { buildJsonReport, exitCodeForJsonReport } = require('../lib/helpers/jsonReport')
const { AUDIT_FAILURE_CODES, createAuditFailure } = require('../lib/helpers/auditFailure')

const fixtures = {
  clean: {
    packages: ['express@latest'],
    marshallResults: { 'express@latest': [] },
    version: '9.9.9'
  },
  warning: {
    packages: ['express@latest'],
    marshallResults: {
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
    },
    version: '9.9.9'
  },
  error: {
    packages: ['express@latest'],
    marshallResults: {
      'express@latest': [
        {
          scripts: {
            marshall: 'scripts',
            categoryId: 'SupplyChainSecurity',
            warnings: [],
            errors: [{ message: 'Install script detected' }]
          }
        }
      ]
    },
    version: '9.9.9'
  },
  malicious: {
    packages: ['bad-one@1.0.0'],
    marshallResults: {
      'bad-one@1.0.0': [
        {
          snyk: {
            marshall: 'snyk',
            categoryId: 'MalwareDetection',
            warnings: [],
            errors: [
              { message: 'Malicious package found: bad-one' },
              { message: 'A second malicious finding' }
            ]
          }
        }
      ]
    },
    version: '9.9.9'
  },
  scopedPackage: {
    packages: ['@scope/tool@^2.0.0'],
    marshallResults: { '@scope/tool@^2.0.0': [] },
    version: '9.9.9'
  },
  partialFailure: {
    packages: ['express@latest'],
    marshallResults: {
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
    },
    failures: [
      {
        code: AUDIT_FAILURE_CODES.PACKAGE_LOOKUP_FAILED,
        message: 'Could not retrieve package metadata',
        package: 'unavailable@1.0.0'
      }
    ],
    version: '9.9.9'
  }
}

describe('JSON audit report', () => {
  test('builds the exact mixed findings report', () => {
    const report = buildJsonReport({
      packages: ['express@latest', '@scope/tool@^2.0.0'],
      marshallResults: {
        'express@latest': [
          {
            age: {
              marshall: 'age',
              categoryId: 'PackageHealth',
              warnings: [{ message: 'Published recently' }],
              errors: []
            }
          },
          {
            scripts: {
              marshall: 'scripts',
              categoryId: 'SupplyChainSecurity',
              warnings: [],
              errors: [{ message: 'Install script detected' }]
            }
          }
        ],
        '@scope/tool@^2.0.0': []
      },
      version: '9.9.9'
    })

    expect(report).toEqual({
      schemaVersion: 1,
      tool: { name: 'npq', version: '9.9.9' },
      status: 'findings',
      summary: { packagesAudited: 2, errors: 1, warnings: 1 },
      packages: [
        {
          requested: 'express@latest',
          findings: [
            {
              severity: 'warning',
              marshall: 'age',
              category: { id: 'PackageHealth', title: 'Package Health' },
              message: 'Published recently'
            },
            {
              severity: 'error',
              marshall: 'scripts',
              category: { id: 'SupplyChainSecurity', title: 'Supply Chain Security' },
              message: 'Install script detected'
            }
          ]
        },
        { requested: '@scope/tool@^2.0.0', findings: [] }
      ],
      failures: []
    })
    expect(exitCodeForJsonReport(report)).toBe(1)
  })

  test('maps clean reports to exit code zero', () => {
    expect(exitCodeForJsonReport(buildJsonReport(fixtures.clean))).toBe(0)
  })

  test('retains all malicious findings', () => {
    const report = buildJsonReport(fixtures.malicious)

    expect(report.packages[0].findings).toHaveLength(2)
    expect(report.summary.errors).toBe(2)
  })

  test('normalizes unknown failure codes without raw exception fields', () => {
    const failure = createAuditFailure('UNSAFE_CODE', 'Safe failure message', {
      package: '@scope/tool@^2.0.0',
      marshall: 'age',
      stack: 'not serialized'
    })

    expect(failure).toEqual({
      code: AUDIT_FAILURE_CODES.INTERNAL_ERROR,
      message: 'Safe failure message',
      package: '@scope/tool@^2.0.0',
      marshall: 'age'
    })
  })

  test('reports partial failures with findings as failed and exit code two', () => {
    const report = buildJsonReport(fixtures.partialFailure)

    expect(report.status).toBe('failed')
    expect(report.packages[0].findings).toHaveLength(1)
    expect(exitCodeForJsonReport(report)).toBe(2)
  })

  test.each(['clean', 'warning', 'error', 'malicious', 'scopedPackage', 'partialFailure'])(
    '%s fixture validates against the v1 schema',
    (fixtureName) => {
      const ajv = new Ajv2020()
      const validate = ajv.compile(schema)

      expect(validate(buildJsonReport(fixtures[fixtureName]))).toBe(true)
    }
  )
})
