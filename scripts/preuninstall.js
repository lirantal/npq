const helpers = require('./scriptHelpers')

const runPreUninstall = async () => {
  const shellConfig = helpers.getShellConfig()
  if (!shellConfig) {
    return
  }

  const { profilePath, aliases } = shellConfig
  await helpers.removeFromFile(profilePath, aliases)
}

module.exports.testable = {
  runPreUninstall
}

if (process.env.NODE_ENV !== 'test') {
  runPreUninstall()
}
