const RepoMarshall = require('../lib/marshalls/repo.marshall')

const testMarshall = new RepoMarshall({
  packageRepoUtils: {
    getPackageInfo: (pkgInfo) => {
      return new Promise((resolve) => {
        resolve(pkgInfo)
      })
    }
  }
})

const fullPkgData = {
  packageName: {
    'dist-tags': {
      latest: '1.0.0'
    },
    versions: {
      '1.0.0': {
        repository: {
          url: 'url'
        }
      }
    }
  }
}

describe('Repo test suites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  test('has the right title', async () => {
    expect(testMarshall.title()).toEqual('Identifying package repository...')
  })

  test('throws the right error when there is no pkg data available', async () => {
    await expect(testMarshall.validate({ packageName: {} })).rejects.toThrow(
      'The package has no associated repository or homepage.'
    )
  })

  test('throws the right error when there is no repo in the pkg data', async () => {
    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {}
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(
      'The package has no associated repository or homepage.'
    )
  })

  test('throws the right error when there is no repo URL in the pkg data', async () => {
    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            repository: {}
          }
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(
      'The package has no associated repository or homepage.'
    )
  })

  test('throws the right error when the repository url does not exist', async () => {
    global.fetch = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('error')))

    await expect(testMarshall.validate(fullPkgData)).rejects.toThrow(
      'No valid repository is associated with the package'
    )
  })

  test('throws the right error when the repository url is unreachable', async () => {
    global.fetch = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('error')))

    fullPkgData.packageName.versions['1.0.0'].repository.url =
      'https://dsfsdfsdfs.abcdeugwecwekjasda.com/'
    await expect(testMarshall.validate(fullPkgData)).rejects.toThrow(
      'The repository associated with the package (https://dsfsdfsdfs.abcdeugwecwekjasda.com/) does not exist or is unreachable at the moment.'
    )
  })

  test('throws the right error when the homepage url does not exist', async () => {
    global.fetch = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('error')))

    const pkgData = {
      packageName: {
        'dist-tags': {
          latest: '1.0.0'
        },
        versions: {
          '1.0.0': {
            repository: {},
            homepage: 'homepage-url'
          }
        }
      }
    }

    await expect(testMarshall.validate(pkgData)).rejects.toThrow(
      'The homepage associated with the package (homepage-url) does not exist or is unreachable at the moment.'
    )
  })

  test('does not throw any errors if the url exists', async () => {
    global.fetch = jest.fn().mockImplementationOnce(() => Promise.resolve('success'))

    fullPkgData.packageName.versions['1.0.0'].repository.url = 'https://google.com'
    await expect(testMarshall.validate(fullPkgData)).resolves.toEqual(expect.anything())
  })
})
