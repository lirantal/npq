const fs = require('fs')
const os = require('os')

const BASH_ZSH_ALIASES = '\nalias npm="npq-hero"\nalias yarn="NPQ_PKG_MGR=yarn npq-hero"\n'
const SHELLS = {
  'bash': {
    profilePath: `${os.homedir()}/.bash_profile`,
    aliases: BASH_ZSH_ALIASES
  },
  'zsh': {
    profilePath: `${os.homedir()}/.zshrc`,
    aliases: BASH_ZSH_ALIASES
  }
}
const SUPPORTED_SHELLS = Object.keys(SHELLS)

module.exports.getShellConfig = () => {
  const shellPath = process.env.SHELL
  if (shellPath) {
    const shell = shellPath.split('/').pop()
    if (SUPPORTED_SHELLS.indexOf(shell) > -1) {
      return { name: shell, ...SHELLS[shell] }
    }
  }
  return null
}

module.exports.fileContains = async (profilePath, aliases) => {
  const profileData = await getProfile(profilePath)
  return !!profileData && profileData.includes(aliases)
}

module.exports.removeFromFile = async (profilePath, aliases) => {
  const profileData = await getProfile(profilePath)
  if (!profileData) {
    return
  }
  const newProfile = profileData.replace(aliases, '')
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.promises.writeFile(profilePath, newProfile)
}

const getProfile = async (profilePath) => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const profileData = await fs.promises.readFile(profilePath, 'utf8')
    return profileData
  } catch (err) {
    if (err && err.code === 'ENOENT') {

    } else if (err) {
      throw err
    }
  }
}
