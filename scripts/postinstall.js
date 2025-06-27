const fs = require('fs')
const { styleText } = require('node:util')
const inquirer = require('inquirer')
const semver = require('semver')

const helpers = require('./scriptHelpers')

const runPostInstall = async () => {
  if (helpers.isRunningInYarn()) {
    // `yarn add` cannot get stdin input, so we can't run this script there
    return
  }

  if (semver.gte(helpers.getNpmVersion(), '7.0.0')) {
    // `npm install` in npm v7 cannot get stdin input, so we can't run this script there
    return
  }

  const shellConfig = helpers.getShellConfig()
  if (!shellConfig) {
    console.log('Could not detect your shell; please add aliases for npq manually.')
    return
  }

  // Postinstall scripts also run when e.g. adding a new dependency,
  // so don't prompt the user if they've already installed aliases
  if (await helpers.fileContains(shellConfig.profilePath, shellConfig.aliases)) {
    return
  }

  try {
    console.log(
      'Thank you for installing npq! We want to help you make conscious decisions before installing potentially dangerous packages.'
    )
    console.log(
      'To do that, we can alias npm and yarn to npq, so that e.g. `npm install <package>` will first use npq to verify the package and prompt you if it finds any issues.'
    )
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: `Do you want to add ${shellConfig.name} aliases for npm and yarn?`
      }
    ])
    if (answers.install) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.promises.appendFile(shellConfig.profilePath, shellConfig.aliases)
      console.log(styleText('green', '✔'), 'Reload your shell profile to use npq!')
    }
  } catch (err) {
    if (err.isTtyError) {
      // Could not render inquirer prompt; abort auto-install
      return
    }
    console.error(styleText('red', 'Failed to add aliases: '), err)
  }
}

module.exports.testable = {
  runPostInstall
}

if (process.env.NODE_ENV !== 'test') {
  runPostInstall()
}
