# Malicious package detection

NPQ flags **known-malicious npm packages** as part of the **Supply Chain Security** checks driven by the Snyk marshall (`lib/marshalls/snyk.marshall.js`). Detection uses either the **Snyk API** (when a token is configured) or the **OSV API** (`api.osv.dev`) as a fallback.

## Overview

- The marshall resolves the package version (including `latest`), queries vulnerability data, and may **throw** an error when issues exist.
- If any reported issue is classified as **malicious**, NPQ throws a dedicated error so the CLI and **`reportResults`** can treat the case differently from ordinary vulnerabilities (single prominent error, warnings suppressed for that package).

## Data sources

| Mode | When | Endpoint / behavior |
|------|------|---------------------|
| **Snyk API** | `SNYK_API_TOKEN` or `SNYK_TOKEN` set, or token in `~/.config/configstore/snyk.json` | `GET` to Snyk npm vuln API (URL overridable via `SNYK_API_URL` / `SNYK_API`) |
| **OSV** | No Snyk token | `POST` to `https://api.osv.dev/v1/query` with `package.name`, `package.ecosystem: "npm"`, and `version` |

Malicious classification is computed from the JSON returned by whichever source is active.

## How “malicious” is determined

### Snyk API response

When `data.vulnerabilities` is present, the package is considered malicious if **any** vulnerability has:

```text
vulnerability.title === "Malicious Package"
```

### OSV response

When `data.vulns` is present, **any** single vuln object can mark the package malicious via `isOsvVulnMalicious` logic:

1. **`database_specific["malicious-packages-origins"]`**  
   If this property exists and its value is an **array** (including an empty array), the vuln counts as malicious. This matches OSV records that tie the advisory to the malicious-packages dataset.

2. **`summary` prefix**  
   If `summary` is a string and, after lowercasing, it **starts with** `"malicious"`, the vuln counts as malicious. This covers summaries such as “Malicious code in …” regardless of original casing.

If **no** vuln matches, `isMaliciousPackage` is `false`. Fetch/parse failures are treated as no issues (`issuesCount: 0`, `isMaliciousPackage: false`).

## Errors thrown by the marshall

When `issuesCount > 0`:

1. **Malicious (Snyk or OSV)** — checked **first**, regardless of token:
   - Message: `Malicious package found: https://snyk.io/vuln/npm:<encodedPackageName>`
   - The Snyk advisory URL is used for both paths so users get a consistent link.

2. **Non-malicious, with Snyk token**  
   - `N vulnerable path(s) found: https://snyk.io/vuln/npm:<encodedPackageName>`

3. **Non-malicious, OSV only**  
   - `N vulnerabilities found by OSV for <packageName>`

This alignment matters because reporting does not inspect structured fields on the error; it keys off the message string (see below).

## How reporting treats malicious packages

`lib/helpers/reportResults.js` scans errors for a substring match:

```text
error.message.includes("Malicious package found")
```

When that matches **any** error for a package:

- Only that error line is shown for errors on that package (other errors for the same package are not listed individually in the same way as the multi-error path).
- **Warnings** for that package are **not** printed (`isPackageMalicious` blocks the warnings branch).
- **Error count** for summary purposes is **1** for that package (malicious is summarized as a single critical outcome).

Other marshall errors (for example messages that say “malicious” in a different wording) do **not** trigger this path unless they contain the exact substring `Malicious package found`.

## Limitations

- Detection depends on **Snyk** and **OSV** coverage; typosquats or novel malware not yet in those databases may not be flagged here.
- OSV heuristics (`malicious-packages-origins`, summary prefix) may evolve with OSV schema and advisory text; the implementation in `snyk.marshall.js` is the source of truth.
- Reporting relies on the **error message string**; changing the thrown message without updating `reportResults` would break the special malicious UI.

## Related code

| Area | File |
|------|------|
| Vulnerability + malicious logic | `lib/marshalls/snyk.marshall.js` |
| Console / plain summary output | `lib/helpers/reportResults.js` |
| Tests (Snyk/OSV + reporting) | `__tests__/marshalls.snyk.test.js`, `__tests__/reportResults.test.js` |
