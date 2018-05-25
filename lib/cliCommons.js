class cliCommons {
  static getInstallCommand () {
    return {
      command: 'install [package...]',
      aliases: ['i', 'add'],
      desc: 'install a package'
    }
  }

  static getOptions () {
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
      }
    }
  }
}

module.exports = cliCommons
