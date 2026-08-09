# Coding-Agent JSON Detection Design

## Purpose and scope

Implement issue #426 by automatically selecting npq's existing JSON audit mode
when a supported coding-agent environment is detected. The behavior applies to
the standalone `npq` executable and to recognized install commands handled by
`npq-hero`.

Automatic selection is equivalent to the existing explicit `--json` flag. It
does not create a second JSON format or change the version 1 JSON schema. JSON
mode remains audit-only: it never prompts, starts an auto-continue countdown,
or invokes the package manager.

This design extends the original JSON audit design, which intentionally left
environment activation and `npq-hero` support out of scope.

## Supported environment signals

Detection recognizes these environment variables:

| Environment variable | Agent or convention |
| --- | --- |
| `CLAUDECODE` | Claude Code |
| `CLAUDE_CODE_CHILD_SESSION` | Claude Code direct tool or hook child |
| `CURSOR_AGENT` | Cursor |
| `PI_CODING_AGENT` | Pi |
| `CODEX_SANDBOX` | Codex |
| `CODEX_THREAD_ID` | Codex |
| `GEMINI_CLI` | Gemini CLI |
| `WINDSURF_AGENT` | Windsurf |
| `CODEIUM_AGENT` | Codeium |
| `AGENT` | Generic agent convention |
| `AI_AGENT` | Emerging generic AI-agent convention |

A signal is active when its value is present and non-empty. Values may be
booleans represented as strings, agent names, filesystem paths, or identifiers;
the detector does not require one vendor-specific value format. Missing and
empty-string values do not activate JSON mode.

## Architecture

Add a focused helper under `lib/helpers/` with this interface:

```js
isCodingAgentEnvironment(env = process.env)
```

The helper owns the supported signal list and returns a boolean. It accepts an
environment object so unit tests and consumers do not need to mutate global
process state. It does not report the detected agent identity because mode
selection only needs a boolean.

Both CLI parsers and both executable bootstrap paths use this helper. Keeping
the signal list centralized prevents `npq` and `npq-hero` from drifting and
allows detection to happen early enough for JSON-safe error handling.

## Standalone `npq` behavior

`CliParser.parseArgsFull()` computes the effective JSON mode before normalizing
package arguments:

```js
const json = values.json === true || isCodingAgentEnvironment()
```

It passes the effective value into the existing JSON package-spec parser and
returns it as `cliArgs.json`. Therefore automatically selected JSON mode has the
same registry-package restrictions and credential-safe failures as explicit
`--json`.

`bin/npq.js` also considers agent detection during its raw bootstrap check. If
full parsing throws while automatic JSON mode is active, the executable writes
the existing schema-valid `INVALID_INPUT` report and exits `2`, just as it does
for an explicit `--json` invocation.

The existing routing after parsing is unchanged: effective JSON mode calls
`runJsonCli()`, while human mode uses the spinner, terminal report, prompt, and
package-manager pipeline. `--help` and `--version` retain their text-only early
exit behavior.

## `npq-hero` behavior

`npq-hero` activates JSON mode only when both conditions are true:

1. a supported coding-agent environment is detected; and
2. the parsed command is a recognized install subcommand.

`CliParser.parseArgsMinimal()` returns the install-command metadata needed for
that decision while retaining package-manager-compatible argument parsing. For
qualifying invocations, package operands use the same JSON-safe registry package
normalization as standalone `npq`.

Examples under a detected agent environment:

```text
npq-hero install express  -> audit express as JSON; do not install
npq-hero install          -> audit current project dependencies as JSON; do not install
npq-hero test             -> pass through to the configured package manager
npq-hero run build        -> pass through to the configured package manager
```

The binary routes qualifying install commands through the existing
`runJsonCli()` coordinator. It does not expose a new `npq-hero --json` CLI flag,
because `npq-hero` arguments belong to the underlying package manager. Non-install
commands preserve their existing passthrough arguments and exit codes even when
agent variables are present. Outside detected agent environments, all existing
`npq-hero` behavior remains unchanged.

## Output, failures, and compatibility

Automatically selected JSON mode inherits all existing JSON invariants:

- stdout contains exactly one schema-version-1 JSON document and one newline;
- stderr contains no auxiliary human output;
- no spinner, prompt, or countdown starts;
- no package manager starts;
- clean audits exit `0`, findings exit `1`, and operational failures exit `2`;
- invalid or unsupported package input produces a sanitized `INVALID_INPUT`
  failure without repeating credentials, paths, or raw input; and
- `SIGINT` produces the existing complete `INTERRUPTED` report.

No field is added to identify which environment signal activated JSON mode.
Consequently `schema/npq-output-v1.schema.json` and its compatibility guarantees
remain unchanged.

## Testing

Unit tests for the detection helper cover every supported variable independently,
an environment with no supported variables, empty-string values, and unrelated
variables.

Parser tests verify that explicit `--json` remains supported, agent detection
enables JSON-safe normalization in `parseArgsFull()`, and `parseArgsMinimal()`
distinguishes install commands from non-install passthrough while preserving
human-mode parsing.

Executable and process-level tests verify schema-valid JSON under representative
vendor and generic signals, safe parser failures, `npq-hero` install audits with
no package-manager invocation, project dependency discovery for bare installs,
non-install passthrough, unchanged human behavior, and the existing one-document
and exit-code contract.

Focused tests run during development. Final verification runs the complete
`npm test` and `npm run lint` commands required by the repository.

## Documentation and release

Update `README.md` near JSON usage with a concise automatic-detection note.
Update `docs/feature/json-output.md` with the full signal list and mode-selection
behavior. Update `docs/feature/alias.md` with the `npq-hero` install-only boundary
and unchanged non-install passthrough behavior.

Add a Changeset because this changes published behavior for both executables.
The implementation remains one focused feature for issue #426.

## Out of scope

- Adding an opt-out or `--no-json` flag.
- Adding a public `--json` flag to `npq-hero`.
- Detecting agents through process ancestry, executable names, terminal probing,
  configuration files, or network calls.
- Reporting the detected agent identity in JSON.
- Changing the JSON schema, report fields, statuses, or exit codes.
- Installing packages from automatically selected JSON mode.
