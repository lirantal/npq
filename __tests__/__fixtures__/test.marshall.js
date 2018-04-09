'use strict'

const BaseMarshall = require('../../lib/marshalls/baseMarshall')

const MARSHALL_NAME = 'test.marshall'

class TestMarshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'A test marshall'
  }

  run (ctx, task) {
    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.mockCheck(currPkg, ctx, task))
    }, [])

    return Promise.all(tasks)
  }

  mockCheck (pkg, ctx, task) {
    return this.validateSomething(pkg)
      .then(() => {
        const data = 'mock data check'
        task.output = `querying ${pkg}...`
        ctx.marshalls[this.name].data[pkg] = data

        return data
      })
      .catch(err => {
        this.setError({
          pkg: pkg,
          message: err.message
        })
      })
  }

  validateSomething (pkg) {
    if (pkg === 'express' || pkg === 'semver') {
      return Promise.resolve()
    } else {
      return Promise.reject(new Error('simulating mock error'))
    }
  }

  validate (pkg) {
    if (pkg === 'express' || pkg === 'semver') {
      return Promise.resolve('validation-result')
    } else {
      return Promise.reject(new Error('simulating mock error'))
    }
  }
}

module.exports = TestMarshall
