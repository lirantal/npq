# Coding-Agent Detection Follow-up Design

## Purpose and scope

Extend npq's existing coding-agent environment detector to cover the remaining
signals identified by the `std-env` comparison. The detector already controls
automatic audit-only JSON mode in `npq` and install-command handling in
`npq-hero`; this change only expands the signals that feed that existing
behavior.

The implementation remains local to npq's CommonJS helper. It does not add a
dependency, change the JSON schema, change parser routing, or change package
manager behavior outside environments recognized by the detector.

## Detection signals

The detector recognizes all existing signals plus these direct environment
variables:

| Signal | Meaning |
| --- | --- |
| `CLAUDE_CODE` | Claude Code |
| `REPL_ID` | Replit runtime |
| `OPENCODE` | OpenCode |
| `AUGMENT_AGENT` | Auggie/Augment agent |
| `GOOSE_PROVIDER` | Goose |
| `JUNIE_DATA` | Junie |
| `JUNIE_SHIM_PATH` | Junie |

A direct signal is active when its value is a non-empty string. `REPL_ID` is
kept as a direct signal to match the upstream convention; because it can also
exist in ordinary Replit sessions, the user-facing documentation calls out
that it selects the same audit-only JSON mode there.

The detector also supports these contextual matchers:

- `PATH` containing `.pi/agent` with either `/` or `\\` separators selects Pi.
- `EDITOR` containing `devin`, case-insensitively, selects Devin.
- `TERM_PROGRAM` containing `kiro`, case-insensitively, selects Kiro only when
  `process.stdout.isTTY` is false. This prevents an interactive Kiro IDE
  terminal from being treated as an agent subprocess.

All existing signals remain supported, including `CLAUDECODE`,
`CLAUDE_CODE_CHILD_SESSION`, `CURSOR_AGENT`, `PI_CODING_AGENT`, the two Codex
signals, `GEMINI_CLI`, Windsurf/Codeium signals, `AGENT`, and `AI_AGENT`.

## Architecture

Keep `isCodingAgentEnvironment(env = process.env)` as the public helper API.
Direct signals remain centralized in the exported frozen signal list. Matcher
logic stays in the same helper so the standalone and hero parsers cannot drift.

For deterministic unit tests, the helper accepts an optional second argument
that can override the observed TTY state. Normal callers omit it and use the
real `process.stdout.isTTY` value.

## Testing

Unit tests will verify:

- the complete direct-signal list and independent detection of every signal;
- empty, missing, and unrelated values;
- Pi paths with POSIX and Windows separators, including non-matching paths;
- Devin editor paths with case variation and non-matching values; and
- Kiro detection in non-TTY mode and suppression in TTY mode.

The existing parser and process tests remain the regression coverage for the
downstream JSON behavior. Focused detector tests run first, followed by the
full test suite and lint command.

## Documentation and release

Update the coding-agent signal table and examples in `docs/feature/json-output.md`
and the automatic-detection note in `README.md`. Add a changeset because the
expanded detection changes published behavior for both executables.

## Out of scope

- Replacing the local helper with `std-env`.
- Reporting the detected agent identity in JSON.
- Changing parser behavior, JSON schema fields, statuses, exit codes, or
  package-manager routing.
- Process ancestry, executable-name, configuration-file, or network detection.
