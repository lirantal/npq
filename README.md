npq allows you to audit npm packages _before_ you install them

[![npm](https://img.shields.io/npm/v/npq)](https://www.npmjs.com/package/npq)
[![license](https://img.shields.io/npm/l/npq)](LICENSE)
[![codecov](https://img.shields.io/codecov/c/gh/lirantal/npq/main)](https://codecov.io/gh/lirantal/npq)
[![CI](https://img.shields.io/github/actions/workflow/status/lirantal/npq/main.yml?branch=main&label=CI&logo=github)](https://github.com/lirantal/npq/actions/workflows/main.yml?query=branch%3Amain)
[![Known Vulnerabilities](https://snyk.io/test/github/lirantal/npq/badge.svg)](https://snyk.io/test/github/lirantal/npq)
[![Security Responsible Disclosure](https://img.shields.io/badge/Security-Responsible%20Disclosure-yellow)](SECURITY.md)

![npq demo screenshot](.github/npq.png)

Media coverage about npq:

- As mentioned on [Thomas Gentilhomme](https://github.com/fraxken)'s French book of [Become a Node.js Developer](https://docs.google.com/document/d/1JHgmEFkc8Py4XSuCB8_DQ5FFEJoogyeninFK6ucTd4o/edit#)
- Tao Bojlén's [A web of trust for npm](https://www.btao.org/2020/10/02/npm-trust.html)
- Zander's [favorite list of command line tools](https://zander.wtf/blog/terminal-commands)
- Ran Bar Zik's [npq review to install safe modules](https://internet-israel.com/%D7%A4%D7%99%D7%AA%D7%95%D7%97-%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98/%D7%91%D7%A0%D7%99%D7%99%D7%AA-%D7%90%D7%AA%D7%A8%D7%99-%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98-%D7%9C%D7%9E%D7%A4%D7%AA%D7%97%D7%99%D7%9D/%D7%91%D7%93%D7%99%D7%A7%D7%94-%D7%A2%D7%9D-npq-%D7%9B%D7%93%D7%99-%D7%9C%D7%95%D7%95%D7%93%D7%90-%D7%94%D7%AA%D7%A7%D7%A0%D7%94-%D7%AA%D7%A7%D7%99%D7%A0%D7%94-%D7%A9%D7%9C-%D7%9E%D7%95%D7%93%D7%95/)
- ostechnix's [How To Safely Install Packages Using Npm Or Yarn On Linux](https://ostechnix.com/how-to-safely-install-packages-using-npm-or-yarn-on-linux)
- debricked's [How to evaluate the security of your NPM Package dependencies](https://debricked.com/blog/2020/03/11/how-to-evaluate-the-security-of-your-npm-package-dependencies)
- JavaScript January advent calendar's post on [Open Source From Heaven, Modules From Hell](https://www.lirantal.com/blog/2019-01-26)
- Liran Tal's [Malicious Modules — what you need to know when installing npm packages](https://www.lirantal.com/blog/malicious-modules-what-you-need-to-know-when-installing-npm-packages-12b2f56d3685)

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

**IMPORTANT**: npq by default uses an auto-continue mode when warnings are detected (no errors), waiting 15 seconds before proceeding with the installation. You can disable this behavior via the `--disable-auto-continue` CLI flag or the `NPQ_DISABLE_AUTO_CONTINUE=true` environment variable to enforce a strict review and security hardened installs. See [the auto-continue documentation](docs/feature/auto-continue.md) for more details.

When npq completes its signal checks it hands over the actual package install job to the package manager (npm by default, or as specified via the `NPQ_PKG_MGR` environment variable).

**DISCLAIMER**: there's no guaranteed absolute safety; a malicious or vulnerable package could still exist that has no security vulnerabilities publicly disclosed and passes npq's checks.

## Demo

<https://github.com/user-attachments/assets/619ab3f6-aa3f-483c-9560-0f18e033e6bf>

## Install

```bash
npm install -g npq
```

*Note: we recommend installing with `npm` rather than `yarn`. That way, `npq` can automatically install shell aliases for you.*

You can also install `npq` via [Homebrew](https://brew.sh) on macOS or Linux:

```bash
brew install npq
```

## Usage

### Install packages with npq

```bash
npq install express
```

### Embed in your day to day

Since `npq` is a pre-step to ensure that the npm package you're installing is safe, you can safely embed it in your day-to-day `npm` usage so there's no need to remember to run `npq` explicitly.

```bash
alias npm='npq-hero'
```

### Offload to package managers

If you're using `yarn`, `pnpm`, or generally want to explicitly tell npq which package manager to use you can specify an environment variable: `NPQ_PKG_MGR=<package-manager>`

Examples:

**Using yarn:**

```bash
alias yarn="NPQ_PKG_MGR=yarn npq-hero"
```

**Using pnpm:**

```bash
NPQ_PKG_MGR=pnpm npx npq install fastify
```

**Using pnpm with alias:**

```bash
alias pnpm="NPQ_PKG_MGR=pnpm npq-hero"
```

Note: `npq` by default will offload all commands and their arguments to the `npm` (or other package manager as specified) after it finished its due-diligence checks for the respective packages.

## Marshalls

| Marshall Name | Description | Notes
| --- | --- | ---
| age | Will show a warning for a package if its age on npm is less than 22 days | Checks a package creation date, not a specific version
| author | Will show a warning if a package has been found without an author field | Checks the latest version for an author
| downloads | Will show a warning for a package if its download count in the last month is less than 20
| readme | Will show a warning if a package has no README or it has been detected as a security placeholder package by npm staff
| repo | Will show a warning if a package has been found without a valid and working repository URL | Checks the latest version for a repository URL
| scripts | Will show a warning if a package has a pre/post install script which could potentially be malicious
| snyk | Will show a warning if a package has been found with vulnerabilities in Snyk's database | For Snyk to work you need to either have the `snyk` npm package installed with a valid API token, or make the token available in the `SNYK_TOKEN` environment variable, and npq will use it
| license | Will show a warning if a package has been found without a license field | Checks the latest version for a license
| expired domains | Will show a warning if a package has been found with one of its maintainers having an email address that includes an expired domain | Checks a dependency version for a maintainer with an expired domain
| signatures | Will compare the package's signature as it shows on the registry's pakument with the keys published on the npmjs.com registry
| provenance | Will verify the package's attestations of provenance metadata for the published package
| version-maturity | Will show a warning if the specific version being installed was published less than 7 days ago | Helps identify recently published versions that may not have been reviewed by the community yet
| newBin | Will show a warning if the package version being installed introduces a new command-line binary (via the `bin` field in `package.json`) that was not present in its previous version. | Helps identify potentially unexpected new executables being added to your `node_modules/.bin/` directory.
| typosquatting | Will show a warning if the package name is similar to a popular package name, which could indicate a potential typosquatting attack. | Helps identify packages that may be trying to trick users into installing them by mimicking popular package names.
| deprecation | Will show a warning if the package version being installed is deprecated. | Helps identify packages that are no longer maintained or recommended for use.

### Disabling Marshalls

To disable a marshall altogether, set an environment variable using with the marshall's shortname.

Example, to disable the Snyk vulnerability marshall:

```bash
MARSHALL_DISABLE_SNYK=1 npq install express
```


#### Available Marshall Environment Variables

Here are all the available environment variable names for disabling specific marshalls:

| Marshall Name    | Environment Variable                          | Description                                         |
|------------------|-----------------------------------------------|-----------------------------------------------------|
| age              | `MARSHALL_DISABLE_AGE`                        | Disable package age checks                          |
| author           | `MARSHALL_DISABLE_AUTHOR`                     | Disable package author verification                 |
| downloads        | `MARSHALL_DISABLE_DOWNLOADS`                  | Disable download count checks                       |
| expired domains  | `MARSHALL_DISABLE_MAINTAINERS_EXPIRED_EMAILS` | Disable expired domain checks for maintainer emails |
| license          | `MARSHALL_DISABLE_LICENSE`                    | Disable license availability checks                 |
| provenance       | `MARSHALL_DISABLE_PROVENANCE`                 | Disable package provenance verification             |
| repo             | `MARSHALL_DISABLE_REPO`                       | Disable repository URL validation                   |
| scripts          | `MARSHALL_DISABLE_SCRIPTS`                    | Disable pre/post install script checks              |
| signatures       | `MARSHALL_DISABLE_SIGNATURES`                 | Disable registry signature verification             |
| snyk             | `MARSHALL_DISABLE_SNYK`                       | Disable Snyk vulnerability checks                   |
| typosquatting    | `MARSHALL_DISABLE_TYPOSQUATTING`              | Disable typosquatting detection                     |
| version-maturity | `MARSHALL_DISABLE_VERSION_MATURITY`           | Disable version maturity checks                     |
| newBin           | `MARSHALL_DISABLE_NEWBIN`                     | Disable new binary introduction checks              |
| deprecation      | `MARSHALL_DISABLE_DEPRECATION`                | Disable deprecation checks                          |

### Run checks on package without installing it

```sh
npq install express --dry-run
```

### Force non-rich text output

```sh
npq install express --plain
```

### Disable auto-continue countdown

By default, when npq detects only warnings (no errors), it automatically proceeds with installation after a 15-second countdown. To disable this behavior and always require explicit confirmation:

**Using the CLI flag:**

```sh
npq install express --disable-auto-continue
```

**Using the environment variable:**

```sh
export NPQ_DISABLE_AUTO_CONTINUE=true
npq install express
```

Or set it permanently in your shell profile (`.bashrc`, `.zshrc`, etc.):

```sh
export NPQ_DISABLE_AUTO_CONTINUE=true
```

When auto-continue is disabled, npq will always prompt for explicit confirmation before proceeding with installation, even when only warnings are detected.

## Learn Node.js Security

<div align="center">

<p>
  <a href="https://nodejs-security.com">
    <img alt="Node.js Security" align="center" src="https://img.shields.io/badge/%F0%9F%A6%84-Learn%20Node.js%20Security%E2%86%92-gray.svg?colorA=5734F5&colorB=5734F5&style=flat" />
  </a>
</p>

![Screenshot 2024-09-12 at 20 14 27](.github/nodejs-security-screenshot.png)

<p>
  Learn Node.js Secure Coding techniques and best practices from <a href="https://www.lirantal.com">Liran Tal</a>
</p>

</div>

## FAQ

1. **Can I use NPQ without having npm or yarn?**

* NPQ will audit a package for possible security issues, but it isn't a replacement for npm or yarn. When you choose to continue installing the package, it will offload the installation process to your choice of either npm or yarn.

2. **How is NPQ different from npm audit?**

* `npm install` will install a module even if it has vulnerabilities; NPQ will display the issues detected, and prompt the user for confirmation on whether to proceed installing it.
* NPQ will run synthetic checks, called [marshalls](https://github.com/lirantal/npq#marshalls), on the characteristics of a module, such as whether the module you are going to install has a `pre-install` script which can be potentially harmful for your system and prompt you whether to install it. Whereas `npm audit` will not perform any such checks, and only consults a vulnerability database for known security issues.
* `npm audit` is closer in functionality to what Snyk does, rather than what NPQ does.

3. **Do I require a Snyk API key in order to use NPQ?**

* It's not required. If NPQ is unable to detect a Snyk API key for the user running NPQ, then it will skip the database vulnerabilities check. We do, however, greatly encourage you to use Snyk, and connect it with NPQ for broader security.

## Contributing

Please consult the [CONTRIBUTING](CONTRIBUTING.md) for guidelines on contributing to this project

## Author

Liran Tal <liran.tal@gmail.com>
