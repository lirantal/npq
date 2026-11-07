# Architecture

## Overview

npq package description: marshall your npm/npm package installs with high quality and class 🎖.

## Repository Structure

- `package.json` - root package scripts and dependency metadata.
- `.changeset/` - Changesets configuration and pending release notes.
- `docs/` - project documentation for maintainers and coding agents.

## Boundaries

- Keep user-facing usage, installation, and examples in the root `README.md`.
- Keep contribution rules in `CONTRIBUTING.md`.
- Keep release workflow details in `RELEASE.md`.
- Keep deeper development and architecture notes in `docs/`.

## Registry version selection

`lib/helpers/resolveManifest.js` is the shared selection path for registry-manifest
checks, including author checks, and `RegistryClient.getManifest()`. It uses
`npm-package-arg` and `npm-pick-manifest` to distinguish exact versions, ranges,
and tags and to apply npm's default-tag, engine, deprecation, and date preferences.
The registry client's flattened npm configuration is supplied to the resolver.
Wildcard requests remain ranges rather than being rewritten to explicit tags.

Selection operates on a copy of the packument because npm's selector normalizes
manifest fields. Missing targets or manifests raise `EREGISTRYRESOLVE`, a registry
audit failure that must not be downgraded to an optional check or a passing result.
Never use semver coercion as a fallback for choosing the version to audit.

The Snyk/OSV vulnerability marshall handles selectors separately and does not use
this shared resolver.

This selection is a registry-metadata check, not an installation plan. Installation
still receives the original arguments. Existing lockfiles, overrides, other package
managers, package-specific release-age exclusions, and registry changes after the
audit can affect the eventual installation. Binding the installed artifact and its
integrity to a verified install plan requires a separate handoff design.
