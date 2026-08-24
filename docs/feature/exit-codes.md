# Exit codes

This document describes how **npq** (`bin/npq.js`) and **npq-hero** (`bin/npq-hero.js`) terminate and which exit codes scripts and CI should expect.

Both executables delegate the real install to a package manager (default `npm`, or `NPQ_PKG_MGR`) when the user chooses to proceed. In that case, the **final exit code is whatever the child package manager returns**, not a separate npq-specific code for “install succeeded.”

## Quick reference

| Code    | Meaning (typical)                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`     | Success for the current mode: clean audit (npq audit-only), successful package manager run, `--help` / `--version`, or SIGINT handler on npq (see below).                                                  |
| `1`     | Audit-only run found marshall **errors or warnings** (npq only). User aborted a prompt (`USER_ABORT`). Some `ABORT_ERR` cases. **Or** the package manager exited with `1`.                                 |
| `-1`    | Unsupported Node (npq fast-fail). Uncaught errors with non-numeric `error`. `CliParser.exit` called with a non-number `errorCode`. `getProjectPackages()` failure without a numeric `packages.error.code`. |
| _other_ | **npq-hero** on old Node: passthrough `spawnSync` status from the real package manager. **npq** / **npq-hero**: any non-zero code the spawned package manager returns (`2`, etc.).                         |

On Unix, exit codes are unsigned 8-bit values; `-1` is often reported as `255` in the shell.

---

## `npq` (`bin/npq.js`)

### Modes

- **Audit-only** — `npq` without an explicit `install` / `i` / `add` (and similar) subcommand, **or** when `--dry-run` is set. Marshalls run, results print, then the process exits **without** calling the package manager.
- **Install path** — Explicit install subcommand **and** not `--dry-run`. After marshalls, npq may prompt or auto-continue, then runs the configured package manager.

- **JSON audit-only** — `npq ... --json` always writes one machine-readable audit report and never calls the package manager. This behavior overrides an explicit `install` subcommand; see [JSON audit output](./json-output.md).

### JSON-mode exit codes

| JSON status | Exit code | Meaning                                                                                 |
| ----------- | --------: | --------------------------------------------------------------------------------------- |
| `clean`     |       `0` | Audit completed with no findings or operational failures.                               |
| `findings`  |       `1` | Audit completed with one or more warning or error findings and no operational failures. |
| `failed`    |       `2` | Audit could not complete reliably and reports one or more operational failures.         |

JSON finding severity is represented in the report, not by additional exit codes. `--help` and `--version` retain their existing text-only early exits.

### Audit-only exit codes

| Outcome                                                          | Exit code |
| ---------------------------------------------------------------- | --------- |
| No marshall errors and no warnings (or no counted result object) | `0`       |
| One or more marshall **errors** or **warnings**                  | `1`       |

This lets CI and scripts treat `npq pkg@version` or `npq install foo --dry-run` as a check that fails when issues are reported.

### Install path exit codes

| Outcome                                                   | Exit code                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| User proceeds and package manager runs                    | Same integer as the child’s exit status (`0` on success, `1` if e.g. `npm` fails, etc.)        |
| Unauthorized non-TTY findings (`NON_INTERACTIVE_INSTALL`) | `1`; package manager is not invoked                                                            |
| Authorized warning-only non-TTY install                   | Package manager exit code                                                                      |
| User declines install (`n` / `no`) or does not proceed    | Process usually ends with **`0`** (package manager is not run; `process.exitCode` is not set). |

Marshall findings on the install path do **not** force a dedicated npq exit code; they only affect prompts and messaging before the optional install.
Error findings do not receive a non-interactive bypass: they still fail closed
with exit code `1` and the package manager is not invoked.

### Other `npq` exits

| Situation                                               | Exit code                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **SIGINT** (Ctrl+C) — `process.on('SIGINT')`            | `0` (via `CliParser.exit`)                                                                    |
| **Node version below 20.13.0** — `noSupportError(true)` | `-1`                                                                                          |
| **`getProjectPackages()` error**                        | `packages.error.code` if numeric, else `-1`                                                   |
| **Rejected promise** in the main chain                  | `error.code` if numeric; `ABORT_ERR` → `1`; `USER_ABORT` → `error.exitCode` or `1`; else `-1` |

`--help` and `--version` are handled in `lib/cli.js` with `process.exit(0)` before the async marshall flow.

---

## `npq-hero` (`bin/npq-hero.js`)

npq-hero is intended as an **npm (or other tool) alias**: it uses minimal argument parsing so flags match the underlying package manager. It does **not** implement audit-only early exit; after checks it tries to spawn the real tool when the user confirms install.

### Node version unsupported

| Environment         | Behavior                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interactive TTY** | Message to stderr, then **`packageManagerPassthrough()`**: `spawnSync` of `NPQ_PKG_MGR` (or `npm`) with the original argv. Exit code = **`spawnSync` status** (can be `null` if signal, etc.). |
| **Non-interactive** | Same passthrough after the error message.                                                                                                                                                      |

There is no `failFast` `-1` exit on npq-hero for old Node; the design is to fall through to the real package manager.

### Normal flow

| Outcome                                                   | Exit code                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| User proceeds; package manager runs                       | Child exit code (`process.exitCode` set from the promise)       |
| Unauthorized non-TTY findings (`NON_INTERACTIVE_INSTALL`) | `1` and no passthrough                                          |
| Authorized warning-only non-TTY install                   | Child exit code (`process.exitCode` set from the promise)       |
| User aborts prompt                                        | `CliParser.exit` with `1` (or `error.exitCode` on `USER_ABORT`) |
| Uncaught error in chain                                   | Same mapping as `npq` (`-1` / `1` / numeric `error.code`)       |

npq-hero does **not** register the **SIGINT** → exit `0` handler that `npq` uses.

### “Silent” / no packages

When the minimal parser yields an empty package list (e.g. non-install npm subcommands), marshalls still run with an empty set; the chain tends toward **`{ install: true }`** and **package manager passthrough**, so the exit code is again the **underlying tool’s** status.

---

## Shared mechanisms

### `CliParser.exit` (`lib/cli.js`)

Used for explicit shutdown with an optional message. Coerces non-numeric `errorCode` to **`-1`**, then `process.exit(exitCode)`.

### Package manager spawn (`lib/packageManager`)

Resolves with the child process **close** event exit code. That value is assigned to **`process.exitCode`** in both binaries (install path only), so the Node process exits with the same code without an extra `process.exit()` in that path.

### Prompts (`lib/helpers/cliPrompt.js`)

Ctrl+C during a prompt can throw with `code: 'USER_ABORT'` and `exitCode: 1`, which the `.catch` handlers translate into `CliParser.exit`.

---

## Summary

- Use **`npq`** in **audit-only** mode when you need a **non-zero exit if marshalls report warnings or errors** (`1`), while **`0`** means the audit reported no issues in the counted summary. Explicit `--json` keeps its separate `0` / `1` / `2` audit contract.
- Use either binary’s **install** path when you care about **install success**; the meaningful code is the **package manager’s**, not a separate npq “marshall failed” code.
- In non-interactive installs, warning-only findings require explicit authorization (`--allow-non-interactive-install`, `NPQ_ALLOW_NON_INTERACTIVE_INSTALL=true`, or coding-agent explicit install detection). Errors never bypass this fail-closed path.
- **`npq-hero`** prioritizes **passthrough** (especially on unsupported Node) over npq’s strict **`npq`-only** fast-fail (`-1`).
