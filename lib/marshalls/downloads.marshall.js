'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'downloads'
const DOWNLOAD_COUNT_THRESHOLD = 20 // threshold per month

class MarshallAge extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Checking package download popularity'
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
      .getDownloadInfo(pkg.packageName)
      .then(downloadCount => {
        if (downloadCount < DOWNLOAD_COUNT_THRESHOLD) {
          throw new Error(
            `detected a low download-count package (downloads last month < ${DOWNLOAD_COUNT_THRESHOLD})`
          )
        }

        return downloadCount
      })
  }
}

module.exports = MarshallAge
