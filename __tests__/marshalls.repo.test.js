const RepoMarshall = require('../lib/marshalls/repo.marshall')
const urlExists = require('url-exists')

jest.mock('url-exists', () => {
  return jest.fn()
})

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

test('formats the URL the right way before checking if it exists', async () => {
  const pkgData = { ...fullPkgData }
  await testMarshall.validate(pkgData)
  expect(urlExists.mock.calls[0][0]).toBe('url')

  pkgData.packageName.versions['1.0.0'].repository.url = 'git://url'
  await testMarshall.validate(pkgData)
  expect(urlExists.mock.calls[1][0]).toBe('https://url')
})

test('throws the right error when the url does not exist', async () => {
  await testMarshall.validate(fullPkgData)
  const callback = urlExists.mock.calls[0][1]
  try {
    callback(null, false)
  } catch (e) {
    expect(e.message).toBe('the repository associated with the package (url) does not exist or is unreachable at the moment.')
  }
})

test('throws the right error when the url check fails', async () => {
  await testMarshall.validate(fullPkgData)
  const callback = urlExists.mock.calls[0][1]
  try {
    callback(new Error('the url check failed'))
  } catch (e) {
    expect(e.message).toBe('the repository associated with the package (url) does not exist or is unreachable at the moment.')
  }
})

test('does not throw any errors if the url exists', async () => {
  await testMarshall.validate(fullPkgData)
  const callback = urlExists.mock.calls[0][1]
  try {
    callback(null, true)
  } catch (e) {
    throw new Error('The url check should not throw any errors')
  }
})
