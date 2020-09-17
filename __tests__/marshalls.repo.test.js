const RepoMarshall = require('../lib/marshalls/repo.marshall')
const axios = require('axios')

jest.mock('axios')

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

test('has the right title', async () => {
  expect(testMarshall.title()).toEqual('Identifying package repository...')
})

test('throws the right error when there is no pkg data available', async () => {
  await expect(testMarshall.validate({ packageName: {} })).rejects.toThrow(
    'the package has no associated repository or homepage.'
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
    'the package has no associated repository or homepage.'
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
    'the package has no associated repository or homepage.'
  )
})

test('throws the right error when the repository url does not exist', async () => {
  axios.get.mockImplementationOnce(() =>
    Promise.reject(new Error('error'))
  )

  await expect(testMarshall.validate(fullPkgData)).rejects.toThrow(
    'the repository associated with the package (url) does not exist or is unreachable at the moment.'
  )
})

test('throws the right error when the homepage url does not exist', async () => {
  axios.get.mockImplementationOnce(() =>
    Promise.reject(new Error('error'))
  )

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
    'the homepage associated with the package (homepage-url) does not exist or is unreachable at the moment.'
  )
})

test('does not throw any errors if the url exists', async () => {
  axios.get.mockImplementationOnce(() =>
    Promise.resolve('success')
  )

  await expect(testMarshall.validate(fullPkgData)).resolves.toEqual(expect.anything())
})
