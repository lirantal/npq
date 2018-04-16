'use strict'

const BaseMarshall = require('./baseMarshall')

const MARSHALL_NAME = 'scripts'

class Marshall extends BaseMarshall {
  constructor (options) {
    super(options)
    this.name = MARSHALL_NAME
  }

  title () {
    return 'Checking package for pre/post install scripts'
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
      const packageVersion =
        pkg.packageVersion === 'latest'
          ? data['dist-tags']['latest']
          : this.packageRepoUtils.parsePackageVersion(pkg.packageVersion)
            .version

      const packageScripts =
        data &&
        data.versions &&
        data.versions[packageVersion] &&
        data.versions[packageVersion]['scripts']

      // blacklisted scripts due to possible malicious intent:
      const blacklistScripts = ['install', 'preinstall', 'postinstall']

      blacklistScripts.forEach(scriptName => {
        if (
          packageScripts &&
          packageScripts.hasOwnProperty(scriptName) &&
          packageScripts[scriptName].length > 0
        ) {
          throw new Error(
            `detected a possible malicious intent script, act carefully: ${scriptName}: ${
              packageScripts[scriptName]
            }`
          )
        }
      })

      return true
    })
  }
}

module.exports = Marshall
