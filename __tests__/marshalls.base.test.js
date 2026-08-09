'use strict'

const TestMarshall = require('./__fixtures__/test.marshall')
const TEST_MARSHALL_NAME = 'test.marshall'
const BaseMarshall = require('../lib/marshalls/baseMarshall')

test('base marshall implemented isEnabled', async () => {
  const testMarshall = new TestMarshall({
    packageRepoUtils: null
  })

  expect(testMarshall.isEnabled()).toBeTruthy()
})

test('checkPackage returns validation data if it was a success', async () => {
  const testMarshall = new TestMarshall({
    packageRepoUtils: null
  })

  const ctx = {
    marshalls: {
      [TEST_MARSHALL_NAME]: {
        data: {}
      }
    }
  }

  const result = await testMarshall.checkPackage({ packageName: 'express' }, ctx, {})
  expect(result).toEqual('validation-result')
})

test('checkPackage sets the error property if the validation failed', async () => {
  const testMarshall = new TestMarshall({
    packageRepoUtils: null
  })

  const pkg = {
    packageString: 'trojan'
  }

  const ctx = {
    marshalls: {
      [TEST_MARSHALL_NAME]: {
        data: {}
      }
    }
  }

  testMarshall.init(ctx)
  await testMarshall.checkPackage(pkg, ctx, {})
  expect(ctx.marshalls[TEST_MARSHALL_NAME].errors[0].pkg).toEqual(pkg.packageString)
})

test('setError sets the errors properly', () => {
  const testMarshall = new TestMarshall({
    packageRepoUtils: null
  })

  const ctx = {
    marshalls: {
      [TEST_MARSHALL_NAME]: {
        data: {}
      }
    }
  }
  const err = {
    pkg: 'test',
    message: 'error message'
  }

  testMarshall.init(ctx)
  testMarshall.setMessage(err)
  expect(ctx.marshalls[TEST_MARSHALL_NAME].errors.length).toEqual(1)
  expect(ctx.marshalls[TEST_MARSHALL_NAME].errors[0]).toEqual(err)
})

test('setWarning sets the warnings properly', () => {
  const testMarshall = new TestMarshall({
    packageRepoUtils: null
  })

  const ctx = {
    marshalls: {
      [TEST_MARSHALL_NAME]: {
        data: {}
      }
    }
  }
  const warn = {
    pkg: 'test',
    message: 'warning message'
  }

  testMarshall.init(ctx)

  testMarshall.setMessage(warn, true)
  expect(ctx.marshalls[TEST_MARSHALL_NAME].warnings.length).toEqual(1)
  expect(ctx.marshalls[TEST_MARSHALL_NAME].warnings[0]).toEqual(warn)
})

test('base marshall implemented isEnabled', async () => {
  const testMarshall = new BaseMarshall({
    packageRepoUtils: null
  })

  testMarshall.validate = jest.fn(() => {
    return Promise.reject(new Error('some mock error'))
  })

  const ctx = { pkgs: ['pkg1'], marshalls: {} }
  const task = {}
  testMarshall.init(ctx, task)
  const result = await testMarshall.run(ctx, task)
  expect(result).toStrictEqual([undefined])
})

test('checkPackage records NotEvaluated separately from findings', async () => {
  const NotEvaluated = require('../lib/helpers/notEvaluated')
  const marshall = new BaseMarshall({ packageRepoUtils: null })
  marshall.name = 'optional'
  marshall.validate = jest.fn().mockRejectedValue(
    new NotEvaluated('configured registry does not expose signing keys', {
      capability: 'signing-keys'
    })
  )
  const ctx = { pkgs: [], marshalls: {} }
  marshall.init(ctx)

  await marshall.checkPackage({ packageString: 'private-package@1.0.0' }, ctx)

  expect(ctx.marshalls.optional.errors).toEqual([])
  expect(ctx.marshalls.optional.warnings).toEqual([])
  expect(ctx.marshalls.optional.notEvaluated).toEqual([
    {
      pkg: 'private-package@1.0.0',
      message: 'configured registry does not expose signing keys'
    }
  ])
})

test('checkPackage rethrows fatal RegistryError', async () => {
  const { RegistryError } = require('../lib/helpers/registryErrors')
  const marshall = new BaseMarshall({ packageRepoUtils: null })
  marshall.name = 'optional'
  marshall.validate = jest.fn().mockRejectedValue(
    new RegistryError('Registry authentication failed', {
      registry: 'https://user:secret@artifactory.example.test/api/npm/npm/',
      code: 'EREGISTRYAUTH',
      statusCode: 401
    })
  )
  const ctx = { pkgs: [], marshalls: {} }
  marshall.init(ctx)

  await expect(
    marshall.checkPackage({ packageString: 'private-package@1.0.0' }, ctx)
  ).rejects.toMatchObject({ code: 'EREGISTRYAUTH', statusCode: 401 })
})

test('checkPackage records structured suggestions separately from errors', async () => {
  const marshall = new BaseMarshall({ packageRepoUtils: null })
  marshall.name = 'version_maturity'
  const error = new Error('recent release')
  error.suggestion = {
    type: 'alternative-version',
    packageName: 'pkg',
    version: '1.0.0',
    packageSpec: 'pkg@1.0.0',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ageDays: 40,
    reason: 'version-recency'
  }
  marshall.validate = jest.fn().mockRejectedValue(error)
  const ctx = { pkgs: [], marshalls: {} }
  marshall.init(ctx)

  await marshall.checkPackage({ packageString: 'pkg@latest' }, ctx)

  expect(ctx.marshalls.version_maturity.suggestions).toEqual([
    {
      pkg: 'pkg@latest',
      type: 'alternative-version',
      packageName: 'pkg',
      version: '1.0.0',
      packageSpec: 'pkg@1.0.0',
      publishedAt: '2026-01-01T00:00:00.000Z',
      ageDays: 40,
      reason: 'version-recency'
    }
  ])
  expect(ctx.marshalls.version_maturity.errors).toEqual([
    {
      pkg: 'pkg@latest',
      message: 'recent release'
    }
  ])
})
