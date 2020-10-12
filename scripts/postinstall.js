const fs = require('fs')
const chalk = require('chalk')
const inquirer = require('inquirer')

const helpers = require('./scriptHelpers')

const runPostInstall = async () => {
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
    const answers = await inquirer.prompt([{
      type: 'confirm',
      name: 'install',
      message: `📎 Looks like you're using ${shellConfig.name}. Do you want to add aliases for npm and yarn?`
    }])
    if (answers['install']) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.promises.appendFile(shellConfig.profilePath, shellConfig.aliases)
      console.log(chalk.green('✔'), 'Reload your shell profile to use npq!')
    }
  } catch (err) {
    if (err.isTtyError) {
      // Could not render inquirer prompt; abort auto-install
      return
    }
    console.error(chalk.red('Failed to add aliases: '), err)
  }
}

module.exports.testable = {
  runPostInstall
}

if (process.env.NODE_ENV !== 'test') {
  runPostInstall()
}
