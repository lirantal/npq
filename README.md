
# npq

npq - marshall your npm/yarn package installs with high quality and class 🎖

[![npm](https://img.shields.io/npm/v/npq.svg)](https://www.npmjs.com/package/npq)
[![npm](https://img.shields.io/npm/l/npq.svg)](https://www.npmjs.com/package/npq)
[![Build Status](https://travis-ci.org/lirantal/npq.svg?branch=master)](https://travis-ci.org/lirantal/npq)
[![Known Vulnerabilities](https://snyk.io/test/github/lirantal/npq/badge.svg)](https://snyk.io/test/github/lirantal/npq)

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)


## About

Once npq is installed, you can safely* install packages:

```bash
npq install express
```

`npq` will perform the following steps to sanity check the package is safe:
* Consult snyk.io database of publically disclosed vulnerabilities to check if a vulnerability exists for this package and its version.
* If no match is found, it continues with the following syntactic herustics:
	* Package age on npm
	* Package download count, popularity
	* Package has pre/post install scripts

If npq is prompted to continue with the install it simply handover the actual package install job to the package manager (npm by default).

*safely - there's no guaranteed safety, a malicious or vulnerable package could still exist that has no discloure published and passes npq's checks.

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
alias npm='npq'
```

### Offload to package managers

`npq` by default will offload all commands and their arguments to the `npm` package manager after it finished its due-dilegence for the respective packages.

If you're using `yarn`, or generally want to explicitly tell npq which package manager should handle the command use one of the following methods:

* A command line option: `--packageManager <npm|yarn>`
* An environment variable: `NPQ_PKG_MGR=yarn`

Example: create an alias with yarn as the package manager:

```bash
alias npm='npq --packageManager yarn'
```

## Contributing

Please consult the [CONTIRBUTING](https://github.com/lirantal/npq/blob/master/CONTRIBUTING.md) for guidelines on contributing to this project

## Author
Liran Tal <liran.tal@gmail.com>
