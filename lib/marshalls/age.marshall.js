'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'age'
const PACKAGE_AGE_THRESHOLD = 22 // specified in days

class MarshallAge extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Checking package maturity'
  }

  isEnabled (ctx) {
    return true
  }

  run (ctx, task) {
    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.checkPackageAge(currPkg, ctx, task))
    }, [])

    return Promise.all(tasks)
  }

  checkPackageAge (pkg, ctx, task) {
    return this.validatePackageAge(pkg)
      .then(data => {
        task.output = `querying ${pkg}...`
        ctx.marshalls[this.name].data[pkg] = data

        // not explicitly required, but a task can return its results
        return data
      })
      .catch(err => {
        this.setError({
          pkg: pkg,
          message: err.message
        })
      })
  }

  validatePackageAge (pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg).then(data => {
      const pkgCreatedDate = data.time.created
      const dateDiff = Date.now() - Date.parse(pkgCreatedDate)

      if (dateDiff < PACKAGE_AGE_THRESHOLD) {
        throw new Error('detected a newly published package, act carefully')
      }

      return dateDiff
    })
  }
}

module.exports = MarshallAge
