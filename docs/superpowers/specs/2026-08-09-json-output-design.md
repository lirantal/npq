# JSON Audit Output Design

## Purpose and scope

Add a versioned `--json` mode to `npq` for CI and machine consumers. It is
always audit-only: it never prompts, auto-continues, or invokes the package
manager, including with an explicit `install` subcommand. `npq-hero` is out of
scope because its arguments intentionally pass through to an npm-compatible
package manager.

These are equivalent JSON audits:

```sh
npq express --json
npq install express --json
npq install express --dry-run --json
```

With no package argument, JSON mode audits dependencies from the current
project's `package.json`. `--dry-run` is accepted as redundant. `--plain`,
`--packageManager`, `--pkgMgr`, and `--disable-auto-continue` have no effect.
`--help` and `--version` retain their existing early-exit text behavior; the
JSON schema applies to audit invocations.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Audit completed with no findings. |
| `1` | Audit completed with one or more warning or error findings. |
| `2` | Audit could not complete reliably and reports operational failures. |

Finding severity is represented in JSON, not additional exit codes. Existing
human-readable `npq` and all `npq-hero` behavior remain unchanged.

## Architecture and data flow

`lib/cli.js` recognizes `--json` and returns a boolean to `bin/npq.js`. The
binary derives audit-only mode before reaching spinner, reporter, prompt,
auto-continue, or package-manager branches.

A lightweight bootstrap detects `--json` in the raw argument vector before full
package parsing. This lets invalid package arguments enter the JSON failure
path instead of throwing before JSON mode is established.

A dedicated pure builder normalizes raw marshall results into the public JSON
model. Terminal and JSON reporting may share normalization, but JSON contains no
terminal-formatted strings and does not expose the nested internal execution
shape.

A single output coordinator serializes and writes the report and selects the
exit code. Project discovery, package lookup, marshall execution, unexpected,
and interruption failures enter this coordinator instead of the human
`CliParser.exit` path. Human mode retains its current behavior.

## Public JSON contract

Every audit writes the same envelope:

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

- `schemaVersion` is the integer public contract version, initially `1`.
- `tool` identifies npq and its installed package version.
- `status` is `clean`, `findings`, or `failed`.
- `summary` counts audited packages and error/warning findings.
- `packages` contains every attempted package, including clean packages, in
  normalized request order.
- `failures` contains operational failures that prevent a reliable audit.

`summary.packagesAudited` always equals `packages.length` and counts normalized
package audit attempts, including entries whose audit later failed.

Status and exit code map exactly:

| Status | Exit | Condition |
| --- | --- | --- |
| `clean` | `0` | No findings and no failures. |
| `findings` | `1` | At least one finding and no failures. |
| `failed` | `2` | At least one failure, including partial audits with findings. |

Summary counts equal the corresponding finding objects. A partial audit retains
trustworthy completed results, but failure takes precedence for status and exit.

### Findings

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

`severity` is `warning` or `error`; `marshall` is the stable check identifier;
`category` contains the existing ID and human title; and `message` contains the
finding. JSON reports every normalized finding. Terminal-only display rules,
including malicious-package emphasis, do not suppress machine findings.

### Operational failures

```json
{
  "code": "PACKAGE_LOOKUP_FAILED",
  "message": "Unable to retrieve package metadata",
  "package": "express@latest"
}
```

`code` and `message` are required. `package` and `marshall` are included when
known. Version 1 defines:

| Code | Meaning |
| --- | --- |
| `INVALID_INPUT` | A package or JSON-mode argument cannot be parsed. |
| `PROJECT_MANIFEST_ERROR` | Project dependency discovery failed. |
| `PACKAGE_LOOKUP_FAILED` | Required registry metadata could not be retrieved. |
| `AUDIT_CHECK_FAILED` | A marshall threw instead of returning findings. |
| `INTERRUPTED` | The audit received `SIGINT`. |
| `INTERNAL_ERROR` | No more specific public code applies. |

Messages are safe for logs. Reports omit stacks, raw errors, authentication
material, request headers, and unsanitized URLs.

## Output invariants

For every JSON audit reaching the supported runtime:

- stdout is exactly one JSON document followed by one newline;
- npq emits no other stdout or stderr text;
- output contains no ANSI or terminal-width formatting;
- spinner, prompt, and auto-continue never start;
- the package manager never starts; and
- a single-write guard prevents competing success, failure, and signal output.

A marshall throw becomes `AUDIT_CHECK_FAILED` instead of printed and omitted.
`SIGINT` emits a `failed` report with `INTERRUPTED` and exits `2`. Human-mode
marshall and signal handling remain unchanged.

## Schema and compatibility

`schema/npq-output-v1.schema.json` uses JSON Schema Draft 2020-12 and ships in
the npm package via the `files` allowlist. It constrains required fields, enums,
non-negative counts, nested shapes, and unknown properties. Contract tests
enforce semantic relationships such as exact counts and status/exit mapping.

Version 1 rejects unknown properties and is frozen once published. Adding,
removing, or changing a field or its semantics therefore requires a new schema
version; wording inside human-readable `message` values may evolve.

## Testing

Parser tests cover `--json` and help. Pure builder tests cover clean,
warning-only, error-only, mixed, multi-package, scoped-package,
malicious-package, partial-failure, and total-failure reports; clean package
retention; counts; and status. Representative documents validate against the
checked-in schema.

CLI tests prove singular parseable output, no auxiliary output, no interactive
functions, no spinner, and no package manager. Cases include explicit
`install`, redundant `--dry-run`, project, registry, marshall, unexpected, and
interruption failures; exit codes `0`/`1`/`2`; and single-write behavior.
Regression tests preserve human `npq` and `npq-hero` behavior.

## Documentation and release

Add a README CI example, `docs/feature/json-output.md`, a `docs/README.md`
entry, updates to `docs/feature/exit-codes.md` and `npq --help`, and a minor
Changesets entry.

## Out of scope

- JSON support for `npq-hero`.
- Streaming or newline-delimited JSON.
- Installing from JSON mode.
- Configuration or environment-variable equivalents of `--json`.
- New informational severities; version 1 mirrors warnings and errors.
