#!/usr/bin/env node
'use strict'

const cli = require('../lib/cli')
const pkgMgr = require('../lib/packageManager')
const Marshall = require('../lib/marshall')

const marshall = new Marshall({
  pkgs: cli.package
})

marshall.process().then(promptInstall => {
  if (!cli.dryRun && promptInstall.install === true) {
    pkgMgr.process(cli.packageManager, cli.package)
  }
})
