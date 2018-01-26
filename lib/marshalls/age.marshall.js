'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'age'
const PACKAGE_AGE_THRESHOLD = 22 // specified in days

class Marshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Checking package maturity'
  }

  run (ctx, task) {
    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.checkPackage(currPkg, ctx, task))
    }, [])

    return Promise.all(tasks)
  }

  checkPackage (pkg, ctx, task) {
    return this.validate(pkg)
      .then(data => {
        task.output = `querying ${pkg.packageString}...`
        ctx.marshalls[this.name].data[pkg.packageString] = data

        // not explicitly required, but a task can return its results
        return data
      })
      .catch(err => {
        this.setError({
          pkg: pkg.packageString,
          message: err.message
        })
      })
  }

  validate (pkg) {
    return this.packageRepoUtils.getPackageInfo(pkg.packageName).then(data => {
      const pkgCreatedDate = data.time.created
      const dateDiff = Date.now() - Date.parse(pkgCreatedDate)

      if (dateDiff < PACKAGE_AGE_THRESHOLD) {
        throw new Error(
          `detected a newly published package (created < ${PACKAGE_AGE_THRESHOLD} days) act carefully`
        )
      }

      return dateDiff
    })
  }
}

module.exports = Marshall
