const RepoMarshall = require('../lib/marshalls/repo.marshall')
const axios = require('axios')

jest.mock('axios')

const testMarshall = new RepoMarshall({
  packageRepoUtils: {
    getPackageInfo: (pkgInfo) => {
      return new Promise((resolve, reject) => {
        process.nextTick(
          () => resolve(pkgInfo)
        )
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

test('throws the right error when there is no pkg data availabile', async () => {
  try {
    await testMarshall.validate({packageName: {}})
  } catch (e) {
    expect(e.message).toEqual(`the package has no associated repository.`)
  }
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
  try {
    await testMarshall.validate(pkgData)
  } catch (e) {
    expect(e.message).toEqual(`the package has no associated repository.`)
  }
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
  try {
    await testMarshall.validate(pkgData)
  } catch (e) {
    expect(e.message).toEqual(`the package has no associated repository.`)
  }
})

test('throws the right error when the url does not exist', async () => {
  axios.get.mockImplementationOnce(() =>
    Promise.reject(new Error('error'))
  )
  try {
    await testMarshall.validate(fullPkgData)
  } catch (e) {
    expect(e.message).toBe('the repository associated with the package (url) does not exist or is unreachable at the moment.')
  }
})

test('does not throw any errors if the url exists', async () => {
  axios.get.mockImplementationOnce(() =>
    Promise.resolve('success')
  )
  try {
    await testMarshall.validate(fullPkgData)
  } catch (e) {
    throw new Error(e, 'The url check should not throw any errors')
  }
})
