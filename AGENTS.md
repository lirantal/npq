# Agent Guidance

## Project Overview

`npq` is a Node.js CLI that audits npm package installs before handing off to the package manager. The main executables live in `bin/npq.js` and `bin/npq-hero.js`; shared implementation code lives under `lib/`.

## Repository Map

- `bin/` contains the CLI entry points.
- `lib/marshalls/` contains the security checks that inspect package metadata, vulnerabilities, signatures, provenance, and related signals.
- `lib/helpers/` contains shared helper modules for registry access, prompts, reporting, repository parsing, and utility logic.
- `__tests__/` contains the Jest test suite.
- `docs/` contains project documentation. Feature-specific docs belong in `docs/feature/` using the singular directory name.
- `scripts/` contains release/build/support scripts.

## Development Commands

- Install dependencies with `npm install`.
- Run tests with `npm test` or `npm run test`.
- Run a focused Jest test with `npx jest __tests__/file.test.js`.
- Run linting with `npm run lint`.
- Run formatting for JavaScript files with `npm run format`.
- Run the build script with `npm run build`.

The project requires Node.js `>=20.13.0`.

## Working Conventions

- Prefer existing CommonJS patterns (`require`, `module.exports`) unless a file already uses a different style.
- Keep marshall behavior covered by focused tests in `__tests__/marshalls.*.test.js` when changing security checks.
- When changing CLI behavior, check both `bin/npq.js` and `bin/npq-hero.js` for differences in audit-only, install, prompt, and package-manager passthrough flows.
- When adding or moving feature documentation, place it in `docs/feature/` and update `docs/README.md` if it should appear in the docs index.
- Avoid committing generated coverage output unless the task explicitly asks for it.
