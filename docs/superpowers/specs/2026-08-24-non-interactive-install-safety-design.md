# Non-Interactive Install Safety Design

## Purpose and scope

Change npq's install routing so that a warning countdown can never approve an
installation when standard input is not interactive. Ordinary CI and other
non-TTY automation must fail closed when an audit reports findings: the process
exits nonzero and the configured package manager is not invoked.

The design also preserves an intentional automation workflow. Ordinary
non-TTY callers may opt in with a clearly named `--allow-non-interactive-install`
flag or the equivalent `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true` environment
variable. A detected coding-agent environment itself is an opt-in for explicit
install commands, so agent-driven `npm install` workflows continue to pass
through to the configured package manager without requiring an additional flag.

This change applies to both `npq` and `npq-hero`, including `npq-hero` when it
is used as an `npm` alias. It does not change package auditing, registry
requests, marshall behavior, or the JSON schema.

## Goals

- Never start or complete an auto-continue countdown outside an interactive
  terminal.
- Ensure ordinary non-TTY warning and error findings exit nonzero without
  invoking the package manager.
- Provide an explicit non-TTY install opt-in for ordinary automation.
- Treat detected coding-agent environments as the opt-in for explicit install
  commands, preserving package-manager passthrough for agent-driven installs.
- Preserve explicit `--json` as a strict audit-only mode.
- Preserve interactive TTY behavior, including countdowns, prompts, Ctrl+C
  handling, and package-manager exit-code propagation.
- Keep `npq-hero` non-install command passthrough unchanged.

## Non-goals

- Automatically installing after error findings in non-TTY environments.
- Changing the JSON report schema, statuses, or exit codes.
- Adding a public `--json` flag to `npq-hero`.
- Changing the coding-agent signal list or detection heuristics.
- Changing the package manager command, arguments, registry configuration, or
  marshall execution.
- Removing `--disable-auto-continue` or `NPQ_DISABLE_AUTO_CONTINUE`.

## Behavior contract

The install path uses the following decision matrix:

| Context | Clean audit | Warnings only | Errors |
| --- | --- | --- | --- |
| Interactive TTY | Install | Existing countdown, or prompt when auto-continue is disabled | Existing confirmation prompt |
| Ordinary non-TTY/CI | Install | Exit nonzero; never invoke the package manager | Exit nonzero; never invoke the package manager |
| Ordinary non-TTY/CI with `--allow-non-interactive-install` or `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true` | Install | Install directly, without a countdown | Still fail closed |
| Detected coding-agent environment with an explicit install command | Install | Install directly, without a countdown | Still fail closed |
| Explicit `--json` | Audit only | Audit only, exit `1` | Audit only, exit `1` |

An explicit install command means `npq install <package>` or a recognized
`npq-hero install <package>` invocation. The latter includes `npq-hero` when it
is invoked through an `npm` alias. `npq <package>` and `npq` without an install
subcommand remain audit-only.

Explicit `--json` has higher priority than coding-agent detection and any
non-interactive install authorization. Therefore a coding-agent invocation such
as `npq install express --json` audits and never invokes the package manager.

When `--disable-auto-continue` or `NPQ_DISABLE_AUTO_CONTINUE=true` is active,
non-TTY warning-only installs remain fail-closed because the caller has
explicitly required confirmation that cannot be collected from a non-interactive
input stream. In an interactive TTY, the existing yes/no prompt remains in
effect.

The policy concerns findings. A clean explicit install remains eligible for the
existing immediate package-manager handoff, including in ordinary non-TTY
execution. A warning-only installation authorized by a flag, environment
variable, or coding-agent detection uses the package manager's eventual exit
code. Error findings do not receive a non-interactive bypass.

## Architecture and data flow

### Install policy

Add a focused pure helper under `lib/helpers/` that maps audit counts and
execution context to one of four actions:

```js
'install'
'prompt'
'countdown'
'reject'
```

The input includes:

```js
{
  countErrors,
  countWarnings,
  isInteractive,
  disableAutoContinue,
  allowNonInteractiveInstall
}
```

Both binaries use this helper after reporting audit results. The helper returns
`'countdown'` only for an interactive warning-only install. It returns
`'install'` for clean audits and authorized warning-only non-TTY installs,
`'prompt'` for interactive error or disabled-auto-continue cases, and
`'reject'` for non-TTY error findings or unauthorized warning findings.

The rejection path throws or propagates a typed error with exit code `1`
before the package-manager promise is reached. Its message explains that a
non-interactive install was blocked and identifies the explicit opt-in needed
for ordinary automation.

### Terminal safety

`lib/helpers/cliPrompt.js` will no longer contain a countdown implementation for
non-TTY environments. `autoContinue()` will defensively reject when standard
input is not a TTY, without writing countdown output or scheduling timers.
The entrypoints will only call it for the policy's interactive `'countdown'`
action.

The interactive-terminal check used by routing will require an interactive
input/output terminal and continue honoring the repository's CI environment
signals. Rich-output decisions such as `--plain` remain separate from whether
input is available for a prompt.

### Standalone `npq`

`CliParser.parseArgsFull()` will recognize:

```text
--allow-non-interactive-install
```

and derive the equivalent environment opt-in from:

```text
NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true
```

The parser will determine whether an explicit install subcommand is present
before selecting automatic coding-agent JSON mode:

- Explicit `--json` always selects JSON audit-only mode.
- A detected coding-agent environment with no explicit install subcommand
  retains automatic JSON/audit-only behavior.
- A detected coding-agent environment with an explicit install subcommand uses
  the normal install pipeline with non-interactive installation authorized.

The returned CLI arguments will carry the effective install authorization and
the routing state needed by `bin/npq.js`. The raw bootstrap check in that binary
will follow the same explicit-`--json` and explicit-install distinction so that
agent install parse failures do not accidentally enter the audit-only JSON
path.

### `npq-hero`

`CliParser.parseArgsMinimal()` will preserve package-manager-compatible argument
parsing and recognized install-subcommand detection. Because `npq-hero` shares
arguments with the underlying package manager, the ordinary automation opt-in
is supplied through `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true` rather than a
npq-specific flag.

For an explicit install command under a detected coding-agent environment,
`npq-hero` will use its normal audit/report/install pipeline with non-interactive
installation authorized. It will not route that install through automatic JSON
audit-only mode. Non-install commands will continue to pass through unchanged,
including under coding-agent detection.

### Precedence

The effective precedence is:

```text
explicit --json
  > explicit non-interactive disable
  > coding-agent or explicit non-interactive install authorization
  > ordinary non-TTY fail-closed behavior
```

## Error handling and compatibility

The non-TTY rejection must happen before the package-manager call. The existing
promise chain must therefore reject or return a failed decision before reaching
`pkgMgr.process()`. The catch path will preserve exit code `1` and avoid a
second package-manager attempt.

Interactive TTY users retain the current warning countdown and confirmation
prompt behavior. Ctrl+C continues to produce the existing `USER_ABORT` error
and exit code `1`. Clean installs continue to hand off to npm or the configured
package manager, whose exit code remains the install-path process exit code.

Automatic coding-agent install passthrough is intentionally limited to explicit
install commands and warning-free or warning-only audits. Non-install agent
audits remain machine-readable/audit-only, and explicit `--json` remains a
strict override. This is the compatibility exception that prevents the
non-TTY fail-closed mitigation from breaking agent-driven package installation.

## Testing

### Helper and policy tests

- Test every policy matrix row for clean, warning-only, and error findings.
- Verify coding-agent authorization works without the new flag.
- Verify ordinary non-TTY warning and error cases reject.
- Verify `--disable-auto-continue` rejects non-TTY warning-only installs even
  when another authorization is present.
- Verify `autoContinue()` rejects immediately when `process.stdin.isTTY` is
  false, writes no countdown output, and schedules no timers.
- Preserve existing TTY countdown, immediate `y`, Ctrl+C, cleanup, and output
  tests.

### Parser and executable tests

- Parse the new standalone flag and environment variable.
- Preserve explicit `--json` precedence.
- Verify standalone coding-agent explicit installs leave automatic JSON mode and
  carry non-interactive authorization.
- Verify standalone coding-agent audits without an install command remain
  audit-only.
- Verify `npq-hero` coding-agent install commands use the install pipeline while
  non-install commands remain passthrough.
- Verify ordinary non-TTY warning-only paths exit nonzero and do not call
  `autoContinue()` or the package manager.
- Verify the explicit flag/environment opt-in calls the package manager directly
  for warning-only results without a countdown.
- Verify coding-agent warning-only installs call the package manager directly
  without JSON routing or a countdown.
- Verify error findings remain fail-closed for ordinary automation and coding
  agents.
- Verify clean install routing and package-manager exit-code propagation remain
  unchanged.

Focused Jest suites will cover `cliPrompt`, policy, parser, CLI routing,
coding-agent process behavior, hero behavior, and exit codes. Final verification
will run `npm test` and `npm run lint`.

## Documentation and release

Update the following user-facing documentation:

- `README.md`: document the explicit non-TTY opt-in and the coding-agent
  explicit-install exception near the existing JSON and auto-continue guidance.
- `docs/feature/auto-continue.md`: replace the non-interactive countdown fallback
  description with the fail-closed rule and explain direct authorized installs.
- `docs/feature/json-output.md`: document that explicit `--json` remains
  audit-only while coding-agent explicit installs use the install pipeline.
- `docs/feature/exit-codes.md`: document non-TTY rejection and the no-package-
  manager guarantee for unauthorized findings.
- `docs/feature/alias.md`: document `npq-hero` coding-agent install routing and
  unchanged non-install passthrough.
- `docs/README.md`: link this design specification.

Add a Changeset because the behavior changes the published install routing of
both executables.

## Out of scope

- A coding-agent environment bypass for error findings.
- A non-interactive countdown or timeout in any environment.
- A new JSON schema version or additional JSON fields.
- A `--json` flag for `npq-hero`.
- Changes to coding-agent detection signals, registry configuration, marshall
  checks, package-manager selection, or package-manager arguments.
