<p align="center">
	<br>
  <img width="200" src="https://github.com/lirantal/npq/raw/master/.github/Logo%20Horizontal.png">
	<br>
	safely* install packages with npm/yarn by auditing them as part of your install process
</p>

[![npm](https://img.shields.io/npm/v/npq.svg)](https://www.npmjs.com/package/npq)
[![npm](https://img.shields.io/npm/l/npq.svg)](https://www.npmjs.com/package/npq)
[![codecov](https://codecov.io/gh/lirantal/npq/branch/master/graph/badge.svg)](https://codecov.io/gh/lirantal/npq)
[![Build Status](https://travis-ci.org/lirantal/npq.svg?branch=master)](https://travis-ci.org/lirantal/npq)
[![Known Vulnerabilities](https://snyk.io/test/github/lirantal/npq/badge.svg)](https://snyk.io/test/github/lirantal/npq)
[![Security Responsible Disclosure](https://img.shields.io/badge/Security-Responsible%20Disclosure-yellow.svg)](./SECURITY.md)


[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

![npq-demo-3-final](https://github.com/lirantal/npq/blob/master/.github/npq-demo.gif?raw=true)


Media coverage about npq:
- Tao Bojlén's [A web of trust for npm](https://www.btao.org/2020/10/02/npm-trust.html)
- Zander's [favorite list of command line tools](https://zander.wtf/blog/terminal-commands)
- Ran Bar Zik's [npq review to install safe modules](https://internet-israel.com/%D7%A4%D7%99%D7%AA%D7%95%D7%97-%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98/%D7%91%D7%A0%D7%99%D7%99%D7%AA-%D7%90%D7%AA%D7%A8%D7%99-%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98-%D7%9C%D7%9E%D7%A4%D7%AA%D7%97%D7%99%D7%9D/%D7%91%D7%93%D7%99%D7%A7%D7%94-%D7%A2%D7%9D-npq-%D7%9B%D7%93%D7%99-%D7%9C%D7%95%D7%95%D7%93%D7%90-%D7%94%D7%AA%D7%A7%D7%A0%D7%94-%D7%AA%D7%A7%D7%99%D7%A0%D7%94-%D7%A9%D7%9C-%D7%9E%D7%95%D7%93%D7%95/)
- ostechnix's [How To Safely Install Packages Using Npm Or Yarn On Linux](https://ostechnix.com/how-to-safely-install-packages-using-npm-or-yarn-on-linux)
- debricked's [How to evaluate the security of your NPM Package dependencies](https://debricked.com/blog/2020/03/11/how-to-evaluate-the-security-of-your-npm-package-dependencies)
- JavaScript January advent calendar's post on [Open Source From Heaven, Modules From Hell](https://www.javascriptjanuary.com/blog/open-source-from-heaven-modules-from-hell)
- Liran Tal's [Malicious Modules — what you need to know when installing npm packages](https://medium.com/@liran.tal/malicious-modules-what-you-need-to-know-when-installing-npm-packages-12b2f56d3685)


## About

Once npq is installed, you can safely* install packages:

```bash
npq install express
```

`npq` will perform the following steps to sanity check that the package is safe by employing syntactic heuristics and querying a CVE database:

* Consult the [snyk.io database of publicly disclosed vulnerabilities](https://snyk.io/vuln) to check if a security vulnerability exists for this package and its version.
* Package age on npm
* Package download count as a popularity metric
* Package has a README file
* Package has a LICENSE file
* Package has pre/post install scripts

If npq is prompted to continue with the install, it simply hands over the actual package install job to the package manager (npm by default).

safely* - there's no guaranteed safety; a malicious or vulnerable package could still exist that has no security vulnerabilities publicly disclosed and passes npq's checks.

## Install

```bash
npm install -g npq
```

*Note: we recommend installing with `npm` rather than `yarn`. That way, `npq` can automatically install shell aliases for you.*

## Usage

### Install packages with npq:

```bash
npq install express
```

### Embed in your day to day

Since `npq` is a pre-step to ensure that the npm package you're installing is safe, you can safely embed it in your day-to-day `npm` usage so there's no need to remember to run `npq` explicitly.

```bash
alias npm='npq-hero'
```

### Offload to package managers

If you're using `yarn`, or generally want to explicitly tell npq which package manager to use you can specify an environment variable: `NPQ_PKG_MGR=yarn`

Example: create an alias with yarn as the package manager:

```bash
alias yarn="NPQ_PKG_MGR=yarn npq-hero"
```

Note: `npq` by default will offload all commands and their arguments to the `npm` package manager after it finished its due-diligence for the respective packages.

## Marshalls

| Marshall Name | Description | Notes
| --- | --- | ---
| age | Will show a warning for a package if its age on npm is less than 22 days | Checks a package creation date, not a specific version
| downloads | Will show a warning for a package if its download count in the last month is less than 20
| readme | Will show a warning if a package has no README or it has been detected as a security placeholder package by npm staff
| scripts | Will show a warning if a package has a pre/post install script which could potentially be malicious
| snyk | Will show a warning if a package has been found with vulnerabilities in snyk's database | For snyk to work you need to either have the `snyk` npm package installed with a valid api token, or make the token available in the SNYK_TOKEN environment variable, and npq will use it
| license | Will show a warning if a package has been found without a license field | Checks the latest version for a license

### Disabling Marshalls

To disable a marshall altogether, set an environment variable using with the marshall's shortname.

Example, to disable snyk:

```
MARSHALL_DISABLE_SNYK=1 npq install express
```

### Using with TravisCI

An example of using lockfile-lint with a `.travis.yml` configuration as part of your build:

```
language: node_js
before_script:
  - npx lockfile-lint --path package-lock.json --validate-https --allowed-hosts npm
install:
  - yarn install
script:
  - yarn run test
```

## FAQ
1. **Can I use NPQ without having npm or yarn?**
* NPQ will audit a package for possible security issues, but it isn't a replacement for npm or yarn. When you choose to continue installing the package, it will offload the installation process to your choice of either npm or yarn.
2. **How is NPQ different from npm audit?**
* `npm install` will install a module even if it has vulnerabilities; NPQ will display the issues detected, and prompt the user for confirmation on whether to proceed installing it.
* NPQ will run synthethic checks, called [marshalls](https://github.com/lirantal/npq#marshalls), on the characteristics of a module, such as whether the module you are going to install has a `pre-install` script which can be potentially harmful for your system and prompt you whether to install it. Whereas `npm audit` will not perform any such checks, and only consults a vulnerability database for known security issues.
* `npm audit` is closer in functionality to what snyk does, rather than what NPQ does.
3. **Do I require a snyk API key in order to use NPQ?**
* It's not required. If NPQ is unable to detect a snyk API key for the user running NPQ, then it will skip the database vulnerabilities check. We do, however, greatly encourage you to use snyk, and connect it with NPQ for broader security.

## Contributing

Please consult the [CONTRIBUTING](https://github.com/lirantal/npq/blob/master/CONTRIBUTING.md) for guidelines on contributing to this project

## Author
Liran Tal <liran.tal@gmail.com>
