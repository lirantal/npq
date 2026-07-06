'use strict'

const fs = require('fs/promises')
const path = require('path')

const TOP_PACKAGES_FILE_PATH = path.join(__dirname, '../data/top-packages.json')

async function downloadTopPackages() {
  const { npmHighImpact } = await import('npm-high-impact')
  return [...new Set(npmHighImpact)]
}

async function saveTopPackagesToFile() {
  const topPackages = await downloadTopPackages()
  await fs.writeFile(TOP_PACKAGES_FILE_PATH, JSON.stringify(topPackages, null, 2))
}

async function main() {
  await saveTopPackagesToFile()
}

main()
