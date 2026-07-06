'use strict'

const fs = require('fs/promises')
const path = require('path')

const TOP_PACKAGES_FILE_PATH = path.join(__dirname, '../data/top-packages.json')
const NPM_HIGH_IMPACT_TOP_PACKAGES_URL = 'https://unpkg.com/npm-high-impact@1.13.0/lib/top.js'
const TOP_PACKAGES_EXPORT_PATTERN = /^export const top = \[\n([\s\S]*)\n\]\n?$/
const TOP_PACKAGE_NAME_PATTERN = /^[ ]{2}'([^'\\]+)',?$/

function parseTopPackages(source) {
  const topPackagesExport = source.match(TOP_PACKAGES_EXPORT_PATTERN)

  if (!topPackagesExport) {
    throw new Error('Unexpected npm-high-impact top packages export format')
  }

  const topPackages = topPackagesExport[1].split('\n').map((line) => {
    const packageName = line.match(TOP_PACKAGE_NAME_PATTERN)

    if (!packageName) {
      throw new Error(`Unexpected npm-high-impact package entry: ${line}`)
    }

    return packageName[1]
  })

  if (topPackages.length === 0) {
    throw new Error('npm-high-impact top packages export is empty')
  }

  return [...new Set(topPackages)]
}

async function downloadTopPackages() {
  // Keep this pinned to a published npm-high-impact artifact for reproducible builds.
  const response = await fetch(NPM_HIGH_IMPACT_TOP_PACKAGES_URL)

  if (!response.ok) {
    throw new Error(
      `Failed to download npm-high-impact top packages: ${response.status} ${response.statusText}`
    )
  }

  return parseTopPackages(await response.text())
}

async function saveTopPackagesToFile() {
  const topPackages = await downloadTopPackages()
  await fs.writeFile(TOP_PACKAGES_FILE_PATH, JSON.stringify(topPackages, null, 2))
}

async function main() {
  await saveTopPackagesToFile()
}

main()
