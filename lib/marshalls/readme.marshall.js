'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'readme'

class Marshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Checking availability of a README'
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
    return this.packageRepoUtils
      .getReadmeInfo(pkg.packageName)
      .then(readmeContents => {
        if (readmeContents === 'ERROR: No README data found!') {
          throw new Error(`package has no README file available`)
        }

        if (readmeContents.indexOf('# Security holding package') === 0) {
          throw new Error(
            'package flagged for security issues and served as place-holder'
          )
        }

        return readmeContents
      })
  }
}

module.exports = Marshall
