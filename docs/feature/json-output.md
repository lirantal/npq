# JSON audit output

`npq --json` produces a versioned, non-interactive audit report for CI and
other machine consumers. JSON mode is always audit-only: it never prompts,
auto-continues, or invokes the package manager.

## Run an audit

Audit a package directly:

```sh
npq express --json
```

An explicit install command is equivalent, but JSON mode still does not install
anything:

```sh
npq install express --json
```

With no package argument, JSON mode discovers dependencies from the current
project's `package.json` and audits them:

```sh
npq --json
```

Project-mode JSON audits currently cover only declared direct dependencies from the current project's `package.json` (`dependencies` and `devDependencies`).
They do not read lockfiles or discover transitive dependencies.

## Coding-agent detection

For npq, automatic coding-agent detection selects JSON/audit-only mode for
invocations without an explicit install subcommand. Explicit install commands
remain in the normal human-readable audit/install pipeline so agent-driven
installs can preserve package-manager behavior. npq-hero uses detection to
authorize explicit install passthrough and keeps non-install commands as
package-manager passthrough.

| Environment variable        | Agent or convention                                                       |
| --------------------------- | ------------------------------------------------------------------------- |
| `CLAUDECODE`                | Claude Code                                                               |
| `CLAUDE_CODE_CHILD_SESSION` | Claude Code direct tool or hook child                                     |
| `CURSOR_AGENT`              | Cursor                                                                    |
| `PI_CODING_AGENT`           | Pi                                                                        |
| `CODEX_SANDBOX`             | Codex                                                                     |
| `CODEX_THREAD_ID`           | Codex                                                                     |
| `GEMINI_CLI`                | Gemini CLI                                                                |
| `WINDSURF_AGENT`            | Windsurf                                                                  |
| `CODEIUM_AGENT`             | Codeium                                                                   |
| `AGENT`                     | Generic agent convention                                                  |
| `AI_AGENT`                  | Emerging generic AI-agent convention                                      |
| `CLAUDE_CODE`               | Claude Code                                                               |
| `REPL_ID`                   | Replit runtime; ordinary Replit runtimes can also select JSON mode        |
| `OPENCODE`                  | OpenCode                                                                  |
| `AUGMENT_AGENT`             | Auggie/Augment agent                                                      |
| `GOOSE_PROVIDER`            | Goose                                                                     |
| `JUNIE_DATA`                | Junie                                                                     |
| `JUNIE_SHIM_PATH`           | Junie                                                                     |
| `PATH`                      | Pi when it contains `.pi/agent` with `/` or `\\` separators               |
| `EDITOR`                    | Devin when it contains `devin`, case-insensitively                        |
| `TERM_PROGRAM`              | Kiro when it contains `kiro`, case-insensitively, and stdout is not a TTY |

Direct signals count as detected when their values are non-empty strings. The
contextual matchers count as detected when their stated environment patterns
match. In particular, REPL_ID can also be present in an ordinary Replit
runtime and still selects JSON mode for non-install npq audits. The Kiro
non-TTY safeguard keeps an interactive Kiro IDE terminal from being treated as
an agent subprocess.

For example:

```sh
CLAUDECODE=1 npq install express
AGENT=goose npq express
AI_AGENT=true npq-hero install express
```

Explicit `--json` is always audit-only: these commands do not prompt,
auto-continue, or invoke a package manager. For automatic coding-agent
detection, non-install audits remain JSON/audit-only, while explicit
`npq install express` and `npq-hero install express` commands continue through
the normal audit/install pipeline and may pass through warning-only installs
without a countdown. `npq --help` and `npq --version` remain text early exits.
The version 1 schema does not expose the detected agent identity.

`npq install express --dry-run --json` is also equivalent. `--dry-run` is
accepted but redundant in JSON mode. `--plain`, `--packageManager`, `--pkgMgr`,
and `--disable-auto-continue` are accepted but have no effect. `--help` and
`--version` remain text-only early exits, so the JSON contract applies only to
audit invocations.

JSON audits accept registry package names with a tag, exact version, or semver
range. Remote tarball URLs, Git URLs, local file or directory paths, and npm
aliases are rejected with `INVALID_INPUT`. Rejection reports never repeat the
unsupported input. This restriction applies both to command-line packages and
dependencies discovered from `package.json`; human-readable mode keeps its
existing package-spec support.

## Report contract

Each audit writes exactly one JSON document followed by a newline, with no
other stdout or stderr output. The report uses this envelope:

```json
{
  "schemaVersion": 1,
  "tool": {
    "name": "npq",
    "version": "1.2.3"
  },
  "status": "clean",
  "summary": {
    "packagesAudited": 1,
    "errors": 0,
    "warnings": 0
  },
  "packages": [
    {
      "requested": "express@latest",
      "findings": []
    }
  ],
  "failures": []
}
```

`summary.packagesAudited` equals `packages.length`; errors and warnings count
the corresponding finding objects. `status` is `clean`, `findings`, or
`failed`. A partial audit retains completed results, but an operational failure
takes precedence and makes the report `failed`.

Findings are reported per package. For example:

```json
{
  "requested": "express@latest",
  "findings": [
    {
      "severity": "warning",
      "marshall": "age",
      "category": {
        "id": "PackageHealth",
        "title": "Package Health"
      },
      "message": "Package was published recently"
    }
  ]
}
```

An operational failure is separate from findings and uses a stable code:

```json
{
  "code": "PACKAGE_LOOKUP_FAILED",
  "message": "Unable to retrieve package metadata",
  "package": "express@latest"
}
```

Failure messages are safe for logs. Reports omit stacks, raw errors,
authentication material, request headers, and unsanitized URLs.

## Status and exit codes

| Status     | Exit code | Meaning                                                                     |
| ---------- | --------: | --------------------------------------------------------------------------- |
| `clean`    |       `0` | Audit completed with no findings and no failures.                           |
| `findings` |       `1` | Audit completed with one or more warning or error findings and no failures. |
| `failed`   |       `2` | Audit could not complete reliably and reports operational failures.         |

On `SIGINT`, npq writes one complete `INTERRUPTED` report and waits for stdout
to drain before exiting `2`. This guarantee also applies when stdout is a
pipe.

Use the exit status directly in CI. This pattern prints the JSON report while
preserving npq's original exit status exactly:

```sh
set +e
report="$(npq install express --json)"
status=$?
set -e
printf '%s\n' "$report"
exit "$status"
```

## Stable failure codes

| Code                     | Meaning                                            |
| ------------------------ | -------------------------------------------------- |
| `INVALID_INPUT`          | A package or JSON-mode argument cannot be parsed.  |
| `PROJECT_MANIFEST_ERROR` | Project dependency discovery failed.               |
| `PACKAGE_LOOKUP_FAILED`  | Required registry metadata could not be retrieved. |
| `AUDIT_CHECK_FAILED`     | A marshall threw instead of returning findings.    |
| `INTERRUPTED`            | The audit received `SIGINT`.                       |
| `INTERNAL_ERROR`         | No more specific public code applies.              |

## Schema and compatibility

The npm package ships the JSON Schema Draft 2020-12 contract at
`schema/npq-output-v1.schema.json`. Version 1 rejects unknown properties and
is frozen once published. Adding, removing, or changing fields or their semantics requires a new schema version; human-readable `message` text may evolve.
