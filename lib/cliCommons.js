const npa = require('npm-package-arg')
class cliCommons {
  static getInstallCommand() {
    return {
      command: 'install [package...]',
      aliases: [
        'i',
        'add',
        'isntall',
        'in',
        'ins',
        'inst',
        'insta',
        'instal',
        'isnt',
        'isnta',
        'isntal'
      ],
      desc: 'install a package',
      handler: (argv) => {
        if (argv && argv.package) {
          for (let i = 0; i < argv.package.length; i++) {
            const parsedPackage = npa(argv.package[i])
            const versionModifier =
              parsedPackage.fetchSpec === '*' ? 'latest' : parsedPackage.fetchSpec
            // eslint-disable-next-line security/detect-object-injection
            argv.package[i] = `${parsedPackage.name}@${versionModifier}`
          }
        }
      }
    }
  }

  static getOptions() {
    return {
      S: {
        alias: ['save', 'save-prod', 'save-optional', 'save-bundle'],
        type: 'boolean'
      },
      g: {
        alias: 'global',
        type: 'boolean'
      },
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
      }
    }
  }
}

module.exports = cliCommons
