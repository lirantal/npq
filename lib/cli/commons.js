const npa = require('npm-package-arg')

class cliCommons {
  static getInstallCommand () {
    return {
      command: 'install [package...]',
      aliases: ['i', 'add'],
      describe: 'install a package',
      builder: (yargs) => yargs
        .usage('Usage: $0 install <packages> [options]')
        .options(cliCommons.getInstallOptions())
        .example('npq install express', '')
        .example('npq add eslint --package-manager yarn', 'install eslint with yarn')
        .example('npq i @babel/core --save-dev', 'install @babel/core as a dev dependency'),
      handler: (argv) => {
        if (argv && argv.package) {
          for (let i = 0; i < argv.package.length; i++) {
            // eslint-disable-next-line security/detect-object-injection
            argv.package[i] = npa(argv.package[i]).name
          }
        }
      }
    }
  }

  static getCheckCommand () {
    return {
      command: 'check',
      describe: 'check already installed packages',
      builder: (yargs) => yargs
        .usage('Usage: $0 check [options]')
        .options(cliCommons.getCheckOptions())
        .example('$0 check', ''),
      handler: () => {}
    }
  }

  static getInstallOptions () {
    return {
      P: {
        alias: ['save-prod', 'peer'],
        type: 'boolean'
      },
      D: {
        alias: ['save-dev', 'dev'],
        type: 'boolean'
      },
      O: {
        alias: ['save-optional', 'optional'],
        type: 'boolean'
      },
      E: {
        alias: ['save-exact', 'exact'],
        type: 'boolean'
      },
      B: {
        alias: 'save-bundle',
        type: 'boolean'
      },
      T: {
        alias: 'tilde',
        type: 'boolean'
      },
      nosave: {
        alias: 'no-save',
        type: 'boolean'
      },
      'dry-run': {
        alias: 'dry-run',
        type: 'boolean'
      },
      'package-manager': {
        alias: ['pkgMgr'],
        choices: ['npm', 'yarn'],
        type: 'string',
        desc: 'the package manager to offload handling the command',
        default: 'npm'
      }
    }
  }

  static getCheckOptions () {
    return {
      d: {
        alias: 'only-dev',
        type: 'boolean',
        desc: 'Only check dev dependencies'
      },
      n: {
        alias: 'no-dev',
        type: 'boolean',
        desc: `Don't check dev dependencies`
      }
    }
  }
}

module.exports = cliCommons
