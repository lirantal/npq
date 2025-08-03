const fs = require('fs/promises')
const path = require('path')

const TOP_PACKAGES_ASSET_URL =
  'https://github.com/lirantal/npm-rank/releases/download/latest/list-package-names.json'

const TOP_PACKAGES_FILE_PATH = path.join(__dirname, '../data/top-packages.json')

async function downloadTopPackages() {
  const response = await fetch(TOP_PACKAGES_ASSET_URL)
  const data = await response.json()
  return data
}

async function saveTopPackagesToFile() {
  const topPackages = await downloadTopPackages()
  await fs.writeFile(TOP_PACKAGES_FILE_PATH, JSON.stringify(topPackages, null, 2))
}

async function main() {
  await saveTopPackagesToFile()
}

main()
