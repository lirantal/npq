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

  const result = await testMarshall.checkPackage('express', ctx, {})
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
