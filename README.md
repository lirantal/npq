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
[![Security Responsible Disclosure](https://img.shields.io/badge/Security-Responsible%20Disclosure-yellow.svg)](https://github.com/nodejs/security-wg/blob/master/processes/responsible_disclosure_template.md)


[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat)](https://github.com/semantic-release/semantic-release)
[![Greenkeeper badge](https://badges.greenkeeper.io/lirantal/npq.svg)](https://greenkeeper.io/)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

![npq-demo-3-final](https://user-images.githubusercontent.com/316371/36325881-d3c9d0d8-1361-11e8-9179-d08a714f034b.gif)


## About

Once npq is installed, you can safely* install packages:

```bash
npq install express
```

`npq` will perform the following steps to sanity check the package is safe by employing syntactic heuristics and querying a CVE database:

* Consult snyk.io database of publicly disclosed vulnerabilities to check if a vulnerability exists for this package and its version.
* Package age on npm
* Package download count as a popularity metric
* Package has a README file
* Package has pre/post install scripts 

If npq is prompted to continue with the install it simply handovers the actual package install job to the package manager (npm by default).

safely* - there's no guaranteed safety, a malicious or vulnerable package could still exist that has no disclosure published and passes npq's checks.

## Install

```bash
npm install -g npq
```

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
| snyk | Will show a warning if a package has been found with vulnerabilities in snyk's database | For snyk to work you need to either have the `snyk` npm package installed with a valid api token, or make the token available in the SNYK_TOKEN environment variable and npq will use it

### Disabling Marshalls

To disable a marshall altogether set an environment variable using with the marshall's shortname.

Example, to disable snyk:

```
MARSHALL_DISABLE_SNYK=1 npq install express
```

## FAQ
1. **Can I use NPQ without having npm or yarn?**
* NPQ will audit a package for possible security issues but it isn't a replacement for npm or yarn. When you choose to continue installing the package it will offload the installation process to either npm or yarn (depends on your choosing).
2. **How is NPQ different from npm audit?**
* npm audit is reserved for npm, but NPQ works for both npm and yarn users
* npm audit installs a module even if it has vulnerabilities, NPQ will display the issues detected and prompt the user for confirmation whether to proceed installing it.
* NPQ will run synthathic checks, called [marshalls](https://github.com/lirantal/npq#marshalls), on the characteristics of a module, such as whether the module you are going to install has a `pre-install` script which can be potentially harmful for your system and prompt you whether to install it. Where as, npm audit will not perform any such checks and only consult a vulnerability database for known security issues.
* npm audit can better be compared with snyk, rather than NPQ.
3. **Do I require to have a snyk API key in order to use NPQ?**
* It's not required. If NPQ won't be able to detect a snyk API key for the user running NPQ then it will skip database vulnerabilities check. We do however greatly encourage you to use snyk and connect it with NPQ for broader security.


## Contributing

Please consult the [CONTRIBUTING](https://github.com/lirantal/npq/blob/master/CONTRIBUTING.md) for guidelines on contributing to this project

## Author
Liran Tal <liran.tal@gmail.com>
