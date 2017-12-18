const TestMarshall = require('./__fixtures__/test.marshall')

test('base marshall implemented isEnabled', async () => {
  const testMarshall = new TestMarshall({
    packageRepoUtils: null
  })

  expect(testMarshall.isEnabled()).toBeTruthy()
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
