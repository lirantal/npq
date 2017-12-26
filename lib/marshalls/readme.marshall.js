'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'readme'

class MarshallAge extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Checking availability of a README'
  }

  run (ctx, task) {
    const tasks = ctx.pkgs.reduce((prevPkg, currPkg) => {
      return prevPkg.concat(this.checkPackageAge(currPkg, ctx, task))
    }, [])

    return Promise.all(tasks)
  }

  checkPackageAge (pkg, ctx, task) {
    return this.validate(pkg)
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

  validate (pkg) {
    return this.packageRepoUtils.getReadmeInfo(pkg).then(readmeContents => {
      if (readmeContents === 'ERROR: No README data found!') {
        throw new Error(`package has no README file available)`)
      }

      return readmeContents
    })
  }
}

module.exports = MarshallAge
