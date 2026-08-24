# Task 3 Report: Parser Opt-In And Coding-Agent Install Routing Metadata

## Status

GREEN — Task 3 implementation complete.

## RED evidence

Command:

`npx jest __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand`

Result: failed as expected after adding the new assertions because `allowNonInteractiveInstall` was not parsed yet and coding-agent explicit installs still forced `json: true`.

## GREEN evidence

Command:

`npx jest __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand --coverage=false`

Result: 11 test suites passed, 389 tests passed, 0 failed in 2.142 seconds.

## Files

- Modified `lib/cli.js`.
- Modified `__tests__/cli.parser.complete.test.js`.
- Modified `__tests__/cli.packageManagerArgs.test.js`.

## Implementation

- Added `allowNonInteractiveInstall` to both full and minimal parser return shapes.
- Added the public `--allow-non-interactive-install` flag to `npq` full parsing and documented the matching `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true` environment variable in help text.
- Split full-parser JSON output routing from JSON-safe package parsing so explicit `--json` stays audit-only while detected coding-agent explicit installs keep safe operand parsing without forcing JSON mode.
- Authorized coding-agent explicit installs as non-interactive install opt-ins for both `npq` and `npq-hero`, while preserving bare package invocation and non-install hero commands as audit/passthrough behavior.
- Kept invalid coding-agent install operands marked with `error.npqJsonMode = true` so sanitized JSON error output remains available even though successful coding-agent installs no longer select JSON mode.

## Verification

- Focused parser suite: `npx jest __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand --coverage=false` — passed.
- Full repository tests: `npm run test` — failed in pre-existing `.worktrees/*` suites unrelated to Task 3. Representative failures were in:
  - `.worktrees/custom-registry-support/__tests__/marshalls.tasks.test.js`
  - `.worktrees/fix-expired-domain-resolved-version/__tests__/customRegistry.integration.test.js`
  - `.worktrees/improve-expired-domain-warning/__tests__/customRegistry.integration.test.js`
  - `.worktrees/issue-424-older-version-suggestion/__tests__/marshalls.tasks.test.js`
- Lint: `npm run lint` — passed, with existing repository warnings only and no errors.
- Diff sanity check: `git diff --check -- lib/cli.js __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js` — passed.

## Self-review

- The precedence matches the brief: explicit `--json` wins, coding-agent explicit installs authorize install routing without selecting JSON output, and coding-agent non-install invocations remain audit-only.
- The existing coding-agent signal detector and JSON schema were left untouched.
- `npq-hero` still has no new public npq-specific CLI flag; its ordinary non-interactive opt-in remains environment-based.
- I intentionally did not update the broader README and feature docs in this task because Task 3 only lands parser metadata/help text; the end-to-end behavior/documentation updates belong with the later pipeline tasks in the approved plan.

## Concerns

- `npm run test` is not clean at the repository level because existing `.worktrees/*` copies fail independently of these parser changes.
- An unrelated untracked file, `.env.development`, was present and intentionally left untouched.


## Review fix (2026-08-24)

Files:

- Modified `__tests__/cli.parser.complete.test.js`.
- Modified `__tests__/cli.packageManagerArgs.test.js`.
- Modified `.superpowers/sdd/task-3-report.md`.

Command:

`npx jest --runTestsByPath __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand --coverage=false`

Result:

- Passed at commit `dbcf2f6` with 2 test suites passed, 88 tests passed, 0 failed.
- Added regression coverage for hero/minimal env authorization via `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true` on an explicit install command, including `json: false`, `allowNonInteractiveInstall: true`, and `installSubcommandExplicit: true` metadata.
- Added full-parser precedence coverage proving explicit `--json` stays audit-only and forces `allowNonInteractiveInstall: false` even when the CLI flag or environment opt-in is present.
- No parser implementation changes were required because the current Task 3 parser already satisfied both reviewed behaviors.


## Review fix (2026-08-24, test-only)

Command:

`npx jest --runTestsByPath __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand --coverage=false`

Result:

- Passed with 2 test suites passed, 88 tests passed, 0 failed.
- Added explicit `--json` precedence coverage for `--allow-non-interactive-install` and `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true`, asserting audit-only JSON behavior and `allowNonInteractiveInstall: false`.
- Confirmed the hero/minimal parser coverage for `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true` on an explicit `install` command still asserts authorization metadata and preserves env cleanup.
- No implementation files were changed in this review-fix pass.
