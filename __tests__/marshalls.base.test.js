const TestMarshall = require('./__fixtures__/test.marshall')
const TEST_MARSHALL_NAME = 'test.marshall'

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

test('checkPackage sets the error property if the validaiton failed', async () => {
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

test('base marshall implemented isEnabled', async () => {
  const testMarshall = new TestMarshall({
    packageRepoUtils: null
  })

  testMarshall.validateSomething = jest.fn(() => {
    return Promise.reject(new Error('some mock error'))
  })

  const ctx = { pkgs: ['pkg1'], marshalls: {} }
  const task = {}
  testMarshall.init(ctx, task)
  await testMarshall.run(ctx, task)
})
