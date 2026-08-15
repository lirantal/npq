# Project audit dependency boundary

## Context

Project-mode audits discover packages with `lib/helpers/sourcePackages.js` by
reading the current project's `package.json`. The helper currently collects
only declared entries from `dependencies` and `devDependencies`; it does not
read lockfiles or resolve transitive dependencies.

The existing general safety disclaimer does not make this project-discovery
boundary clear enough to users. The provenance documentation already notes the
transitive-coverage limitation, so the user-facing project-mode documentation
should state the same boundary explicitly until dependency-graph discovery is
implemented.

## Design

Update both user-facing entry points:

1. Add a concise caveat after the project-mode description in `README.md`.
2. Add an explicit caveat after project dependency discovery is described in
   `docs/feature/json-output.md`.

Both notes will say that project-mode audits currently cover declared direct
dependencies from `package.json` (`dependencies` and `devDependencies`), not
lockfile sources or transitive dependencies.

## Non-goals

- Do not change dependency discovery or audit behavior.
- Do not add lockfile parsing or dependency-graph resolution.
- Do not remove or rewrite the existing general safety disclaimer.
- Do not add a changeset for this documentation-only clarification.

## Acceptance criteria

- The README and JSON audit documentation explicitly identify the covered
  inputs as declared direct dependencies in `package.json`.
- Both documents explicitly state that lockfile sources and transitives are
  outside the current project-mode audit boundary.
- The wording does not imply that the stronger dependency-graph solution is
  already implemented.
- Markdown formatting and repository checks remain clean.
