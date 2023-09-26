const SignaturesMarshall = require('../lib/marshalls/signatures.marshall')

const testMarshall = new SignaturesMarshall({
  packageRepoUtils: {
    getPackageInfo: (pkgInfo) => {
      return new Promise((resolve) => {
        resolve(pkgInfo)
      })
    }
  }
})

describe('Signature test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  test('has the right title', async () => {
    expect(testMarshall.title()).toEqual('Verifying registry signatures for package')
  })
})
