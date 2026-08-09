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

| Status | Exit code | Meaning |
|---|---:|---|
| `clean` | `0` | Audit completed with no findings and no failures. |
| `findings` | `1` | Audit completed with one or more warning or error findings and no failures. |
| `failed` | `2` | Audit could not complete reliably and reports operational failures. |

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

| Code | Meaning |
|---|---|
| `INVALID_INPUT` | A package or JSON-mode argument cannot be parsed. |
| `PROJECT_MANIFEST_ERROR` | Project dependency discovery failed. |
| `PACKAGE_LOOKUP_FAILED` | Required registry metadata could not be retrieved. |
| `AUDIT_CHECK_FAILED` | A marshall threw instead of returning findings. |
| `INTERRUPTED` | The audit received `SIGINT`. |
| `INTERNAL_ERROR` | No more specific public code applies. |

## Schema and compatibility

The npm package ships the JSON Schema Draft 2020-12 contract at
`schema/npq-output-v1.schema.json`. Version 1 rejects unknown properties and
is frozen once published. Adding, removing, or changing fields or their semantics requires a new schema version; human-readable `message` text may evolve.
