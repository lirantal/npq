# JSON Audit Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable `npq --json` audit mode that writes one schema-valid document, never interacts or installs, and exits 0/1/2 for clean/findings/failure.

**Architecture:** Detect JSON intent before package parsing, then route to a dedicated JSON coordinator instead of the current human pipeline. Pure helpers build the versioned report; the marshall pipeline optionally captures operational failures without changing human behavior.

**Tech Stack:** Node.js 24 CommonJS, `node:util.parseArgs`, Jest 30, JSON Schema Draft 2020-12, Ajv 8 for development-time validation, npm/semantic-release.

## Global Constraints

- `--json` applies to `npq` only; `npq-hero` remains unchanged.
- JSON mode is audit-only even with an explicit `install`.
- Spinner, prompt, auto-continue, and package-manager code are unreachable.
- Stdout is one JSON document plus one newline; npq emits no other output.
- Exit `0` is clean, `1` is findings, and `2` is incomplete/failed.
- Schema v1 rejects unknown properties and is frozen after publication.
- Human `npq` and all `npq-hero` behavior remain unchanged.
- Engines remain Node `>=24.0.0` and npm `>=11.10.0`.
- Use `feat:` commits so semantic-release produces a minor release.

---

## File map

- `lib/helpers/auditFailure.js`: stable operational-failure codes.
- `lib/helpers/jsonReport.js`: pure normalization, envelope, status, and exit code.
- `lib/helpers/jsonOutput.js`: once-only serializer/writer.
- `lib/jsonAudit.js`: project discovery and marshall orchestration.
- `lib/jsonCli.js`: process-facing completion, invalid input, and SIGINT.
- `schema/npq-output-v1.schema.json`: shipped Draft 2020-12 contract.
- New focused tests: `jsonReport.test.js`, `jsonOutput.test.js`,
  `jsonAudit.test.js`, and `jsonCli.test.js`.
- Existing parser, marshall, CLI, exit-code, docs, and package metadata files
  change only at their established seams.

### Task 1: Parse and advertise `--json`

**Files:**
- Modify: `lib/cli.js`
- Test: `__tests__/cli.parser.complete.test.js`

**Interfaces:**
- Produces: `parseArgsFull().json: boolean`.
- Preserves: `parseArgsMinimal()` does not recognize JSON.

- [ ] **Step 1: Write failing parser tests**

Add:

```js
test('enables JSON audit mode', () => {
  mockParseArgs.mockReturnValue({
    values: { json: true },
    positionals: ['install', 'express']
  })

  expect(CliParser.parseArgsFull()).toEqual({
    packages: ['express@latest'],
    packageManager: 'npm',
    dryRun: false,
    plain: false,
    json: true,
    disableAutoContinue: false,
    installSubcommandExplicit: true
  })
})

test('defaults JSON audit mode to false', () => {
  mockParseArgs.mockReturnValue({ values: {}, positionals: ['express'] })
  expect(CliParser.parseArgsFull().json).toBe(false)
})

test('describes JSON as audit-only in help', () => {
  mockParseArgs.mockReturnValue({ values: { help: true }, positionals: [] })
  CliParser.parseArgsFull()
  expect(consoleLogSpy).toHaveBeenCalledWith(
    expect.stringContaining('--json                  Emit JSON and never install')
  )
})
```

Add `json: false` to every existing full-object parser expectation.

- [ ] **Step 2: Verify failure**

Run: `npm test -- --runInBand __tests__/cli.parser.complete.test.js`

Expected: FAIL because `json` is absent.

- [ ] **Step 3: Implement**

Add to full options:

```js
json: { type: 'boolean' },
```

Add to help:

```text
      --json                  Emit JSON and never install
```

Add to the returned object:

```js
json: values.json || false,
```

- [ ] **Step 4: Verify and commit**

Run:

```sh
npm test -- --runInBand __tests__/cli.parser.complete.test.js __tests__/cli.parser.test.js
git add lib/cli.js __tests__/cli.parser.complete.test.js
git commit -m "feat(cli): parse JSON audit flag"
```

Expected: tests PASS and the commit succeeds.

### Task 2: Implement the versioned report and schema

**Files:**
- Create: `lib/helpers/auditFailure.js`
- Create: `lib/helpers/jsonReport.js`
- Create: `schema/npq-output-v1.schema.json`
- Create: `__tests__/jsonReport.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `AUDIT_FAILURE_CODES` and `createAuditFailure(code, message, context)`.
- Produces: `buildJsonReport({ packages, marshallResults, failures, version })`.
- Produces: `exitCodeForJsonReport(report): 0 | 1 | 2`.

- [ ] **Step 1: Add failing report tests**

Create fixtures for clean, warning, error, malicious, scoped-package, and
partial-failure results. Assert this exact mixed report:

```js
const report = buildJsonReport({
  packages: ['express@latest', '@scope/tool@^2.0.0'],
  marshallResults: {
    'express@latest': [
      {
        age: {
          marshall: 'age',
          categoryId: 'PackageHealth',
          warnings: [{ message: 'Published recently' }],
          errors: []
        }
      },
      {
        scripts: {
          marshall: 'scripts',
          categoryId: 'SupplyChainSecurity',
          warnings: [],
          errors: [{ message: 'Install script detected' }]
        }
      }
    ],
    '@scope/tool@^2.0.0': []
  },
  version: '9.9.9'
})

expect(report).toEqual({
  schemaVersion: 1,
  tool: { name: 'npq', version: '9.9.9' },
  status: 'findings',
  summary: { packagesAudited: 2, errors: 1, warnings: 1 },
  packages: [
    {
      requested: 'express@latest',
      findings: [
        {
          severity: 'warning',
          marshall: 'age',
          category: { id: 'PackageHealth', title: 'Package Health' },
          message: 'Published recently'
        },
        {
          severity: 'error',
          marshall: 'scripts',
          category: {
            id: 'SupplyChainSecurity',
            title: 'Supply Chain Security'
          },
          message: 'Install script detected'
        }
      ]
    },
    { requested: '@scope/tool@^2.0.0', findings: [] }
  ],
  failures: []
})
expect(exitCodeForJsonReport(report)).toBe(1)
```

Also assert: clean => `0`; any failure plus findings => `failed`/`2`;
all malicious findings remain present; unknown failure code becomes
`INTERNAL_ERROR`; and clean/findings/failed fixtures validate against the
checked-in schema with Ajv 2020.

- [ ] **Step 2: Install Ajv and verify test failure**

Run:

```sh
npm install --save-dev ajv@^8.17.1
npm test -- --runInBand __tests__/jsonReport.test.js
```

Expected: dependency files update, then tests FAIL because helpers/schema are
absent.

- [ ] **Step 3: Create operational-failure primitives**

Create `lib/helpers/auditFailure.js`:

```js
'use strict'

const AUDIT_FAILURE_CODES = Object.freeze({
  INVALID_INPUT: 'INVALID_INPUT',
  PROJECT_MANIFEST_ERROR: 'PROJECT_MANIFEST_ERROR',
  PACKAGE_LOOKUP_FAILED: 'PACKAGE_LOOKUP_FAILED',
  AUDIT_CHECK_FAILED: 'AUDIT_CHECK_FAILED',
  INTERRUPTED: 'INTERRUPTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
})

const knownCodes = new Set(Object.values(AUDIT_FAILURE_CODES))

function createAuditFailure(code, message, context = {}) {
  const failure = {
    code: knownCodes.has(code) ? code : AUDIT_FAILURE_CODES.INTERNAL_ERROR,
    message: String(message)
  }

  if (context.package) failure.package = String(context.package)
  if (context.marshall) failure.marshall = String(context.marshall)
  return failure
}

module.exports = { AUDIT_FAILURE_CODES, createAuditFailure }
```

Call sites pass static safe messages, never raw exception messages.

- [ ] **Step 4: Create the pure report builder**

Create `lib/helpers/jsonReport.js`:

```js
'use strict'

const pkg = require('../../package.json')
const { marshallCategories } = require('../marshalls/constants')
const { createAuditFailure } = require('./auditFailure')

function normalizeMarshallGroup(group = {}) {
  const findings = []

  for (const value of Object.values(group)) {
    if (!value || typeof value !== 'object') continue
    const category = marshallCategories[value.categoryId] || {
      id: value.categoryId,
      title: value.categoryId
    }

    for (const warning of value.warnings || []) {
      findings.push({
        severity: 'warning',
        marshall: value.marshall,
        category: { id: category.id, title: category.title },
        message: warning.message
      })
    }
    for (const error of value.errors || []) {
      findings.push({
        severity: 'error',
        marshall: value.marshall,
        category: { id: category.id, title: category.title },
        message: error.message
      })
    }
  }

  return findings
}

function buildJsonReport({
  packages = [],
  marshallResults = {},
  failures = [],
  version = pkg.version
} = {}) {
  const packageReports = packages.map((requested) => ({
    requested,
    findings: (marshallResults[requested] || []).flatMap(normalizeMarshallGroup)
  }))
  const findings = packageReports.flatMap((entry) => entry.findings)
  const errors = findings.filter((item) => item.severity === 'error').length
  const warnings = findings.filter((item) => item.severity === 'warning').length
  const status =
    failures.length > 0 ? 'failed' : errors + warnings > 0 ? 'findings' : 'clean'

  return {
    schemaVersion: 1,
    tool: { name: 'npq', version },
    status,
    summary: { packagesAudited: packageReports.length, errors, warnings },
    packages: packageReports,
    failures: failures.map((failure) =>
      createAuditFailure(failure.code, failure.message, {
        package: failure.package,
        marshall: failure.marshall
      })
    )
  }
}

function exitCodeForJsonReport(report) {
  return report.status === 'failed' ? 2 : report.status === 'findings' ? 1 : 0
}

module.exports = { buildJsonReport, exitCodeForJsonReport }
```

- [ ] **Step 5: Create the Draft 2020-12 schema**

Create `schema/npq-output-v1.schema.json` with
`additionalProperties: false` at every object level. Require the top-level
fields `schemaVersion`, `tool`, `status`, `summary`, `packages`, and `failures`.
Use these exact constraints:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/lirantal/npq/main/schema/npq-output-v1.schema.json",
  "title": "npq JSON audit output v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "tool", "status", "summary", "packages", "failures"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "tool": { "$ref": "#/$defs/tool" },
    "status": { "enum": ["clean", "findings", "failed"] },
    "summary": { "$ref": "#/$defs/summary" },
    "packages": { "type": "array", "items": { "$ref": "#/$defs/package" } },
    "failures": { "type": "array", "items": { "$ref": "#/$defs/failure" } }
  },
  "$defs": {
    "tool": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "version"],
      "properties": {
        "name": { "const": "npq" },
        "version": { "type": "string", "minLength": 1 }
      }
    },
    "summary": {
      "type": "object",
      "additionalProperties": false,
      "required": ["packagesAudited", "errors", "warnings"],
      "properties": {
        "packagesAudited": { "type": "integer", "minimum": 0 },
        "errors": { "type": "integer", "minimum": 0 },
        "warnings": { "type": "integer", "minimum": 0 }
      }
    },
    "package": {
      "type": "object",
      "additionalProperties": false,
      "required": ["requested", "findings"],
      "properties": {
        "requested": { "type": "string", "minLength": 1 },
        "findings": { "type": "array", "items": { "$ref": "#/$defs/finding" } }
      }
    },
    "finding": {
      "type": "object",
      "additionalProperties": false,
      "required": ["severity", "marshall", "category", "message"],
      "properties": {
        "severity": { "enum": ["warning", "error"] },
        "marshall": { "type": "string", "minLength": 1 },
        "category": { "$ref": "#/$defs/category" },
        "message": { "type": "string" }
      }
    },
    "category": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "title"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "title": { "type": "string", "minLength": 1 }
      }
    },
    "failure": {
      "type": "object",
      "additionalProperties": false,
      "required": ["code", "message"],
      "properties": {
        "code": {
          "enum": [
            "INVALID_INPUT",
            "PROJECT_MANIFEST_ERROR",
            "PACKAGE_LOOKUP_FAILED",
            "AUDIT_CHECK_FAILED",
            "INTERRUPTED",
            "INTERNAL_ERROR"
          ]
        },
        "message": { "type": "string", "minLength": 1 },
        "package": { "type": "string", "minLength": 1 },
        "marshall": { "type": "string", "minLength": 1 }
      }
    }
  }
}
```

- [ ] **Step 6: Verify and commit**

Run:

```sh
npm test -- --runInBand __tests__/jsonReport.test.js __tests__/reportResults.test.js
git add package.json package-lock.json schema/npq-output-v1.schema.json lib/helpers/auditFailure.js lib/helpers/jsonReport.js __tests__/jsonReport.test.js
git commit -m "feat: define versioned JSON audit report"
```

Expected: tests PASS and the schema validates all three statuses.

### Task 3: Capture registry and marshall operational failures

**Files:**
- Modify: `lib/marshall.js`
- Modify: `lib/marshalls/index.js`
- Test: `__tests__/marshalls.tasks.test.js`
- Test: `__tests__/marshalls.classMethods.test.js`

**Interfaces:**
- Consumes: optional `onAuditFailure(failure)` in `new Marshall(options)`.
- Preserves: without the callback, existing throws and console errors remain.

- [ ] **Step 1: Write failing tests**

Add cases asserting:

```js
await expect(
  marshalls.tasks(
    {
      pkgs: [{ packageName: 'express', packageString: 'express@latest' }],
      packageRepoUtils: {
        getPackageInfo: jest.fn().mockRejectedValue(new Error('token=secret'))
      }
    },
    null,
    { onAuditFailure }
  )
).resolves.toEqual([])

expect(onAuditFailure).toHaveBeenCalledWith({
  code: 'PACKAGE_LOOKUP_FAILED',
  message: 'Unable to retrieve package metadata',
  package: 'express@latest'
})
```

Mock `buildMarshallTasks` with a descriptor whose `execute` rejects and assert:

```js
expect(onAuditFailure).toHaveBeenCalledWith({
  code: 'AUDIT_CHECK_FAILED',
  message: 'Audit check could not complete',
  package: 'express@latest',
  marshall: 'repo'
})
```

Also assert lookup rejection still rejects without a callback and
`buildMarshallTasks` descriptors expose `name: marshall.name`.

- [ ] **Step 2: Verify failure**

Run: `npm test -- --runInBand __tests__/marshalls.tasks.test.js __tests__/marshalls.classMethods.test.js`

Expected: FAIL because capture is not implemented.

- [ ] **Step 3: Thread the callback through `Marshall`**

In the constructor add:

```js
this.onAuditFailure =
  typeof options.onAuditFailure === 'function' ? options.onAuditFailure : null
```

Call:

```js
return Marshalls.tasks(config, this.progressManager, {
  onAuditFailure: this.onAuditFailure
})
```

- [ ] **Step 4: Capture safe failures in `Marshalls.tasks`**

Import `AUDIT_FAILURE_CODES` and `createAuditFailure`, add
`name: marshall.name` to task descriptors, and change the signature to:

```js
static async tasks(options, progressManager, { onAuditFailure = null } = {})
```

Wrap warm-up:

```js
let packagesDataList
try {
  packagesDataList = await Marshalls.warmUpPackagesCache(options)
} catch (error) {
  if (!onAuditFailure) throw error

  for (const pkg of options.pkgs) {
    onAuditFailure(
      createAuditFailure(
        AUDIT_FAILURE_CODES.PACKAGE_LOOKUP_FAILED,
        'Unable to retrieve package metadata',
        { package: pkg.packageString }
      )
    )
  }
  return marshallResults
}
```

Replace the task catch with:

```js
} catch (error) {
  if (!onAuditFailure) {
    console.error(`Error running task ${marshall.title}:`, error)
    continue
  }

  for (const pkg of options.pkgs) {
    onAuditFailure(
      createAuditFailure(
        AUDIT_FAILURE_CODES.AUDIT_CHECK_FAILED,
        'Audit check could not complete',
        { package: pkg.packageString, marshall: marshall.name }
      )
    )
  }
}
```

Keep package-not-found as an ordinary error finding.

- [ ] **Step 5: Verify and commit**

Run:

```sh
npm test -- --runInBand __tests__/marshalls.tasks.test.js __tests__/marshalls.classMethods.test.js __tests__/marshalls.base.test.js
git add lib/marshall.js lib/marshalls/index.js __tests__/marshalls.tasks.test.js __tests__/marshalls.classMethods.test.js
git commit -m "feat: capture incomplete JSON audit checks"
```

Expected: tests PASS; captured objects contain no raw exception detail.

### Task 4: Add audit orchestration and once-only output

**Files:**
- Create: `lib/helpers/jsonOutput.js`
- Create: `lib/jsonAudit.js`
- Create: `lib/jsonCli.js`
- Create: `__tests__/jsonOutput.test.js`
- Create: `__tests__/jsonAudit.test.js`
- Create: `__tests__/jsonCli.test.js`

**Interfaces:**
- `createJsonOutput(write?) -> { write(report), hasWritten() }`.
- `runJsonAudit(cliArgs, dependencies?) -> Promise<report>`.
- `runJsonCli(cliArgs, dependencies?) -> Promise<report>`.
- `writeInvalidJsonInvocation(output?) -> report`.

- [ ] **Step 1: Write failing unit tests**

Assert the writer calls its injected function once with:

```js
`${JSON.stringify(report)}\n`
```

Assert `runJsonAudit`:
- discovers project dependencies when `packages` is empty;
- returns `PROJECT_MANIFEST_ERROR` with message
  `Unable to read project package.json` and no raw path;
- collects callback failures alongside partial results; and
- maps unexpected exceptions to safe `INTERNAL_ERROR`.

Assert `runJsonCli`:
- writes once and assigns `exitCodeForJsonReport(report)`;
- converts a rejected injected audit into a safe `INTERNAL_ERROR` report;
- on `SIGINT` writes `INTERRUPTED` once and calls `processTarget.exit(2)`;
- `writeInvalidJsonInvocation` emits `INVALID_INPUT` once.

Use an injected `EventEmitter` as `processTarget` so no test exits Node.

- [ ] **Step 2: Verify failure**

Run:

```sh
npm test -- --runInBand __tests__/jsonOutput.test.js __tests__/jsonAudit.test.js __tests__/jsonCli.test.js
```

Expected: FAIL because modules are absent.

- [ ] **Step 3: Implement the writer**

Create `lib/helpers/jsonOutput.js`:

```js
'use strict'

function createJsonOutput(write = (value) => process.stdout.write(value)) {
  let written = false

  return {
    write(report) {
      if (written) return false
      written = true
      write(`${JSON.stringify(report)}\n`)
      return true
    },
    hasWritten() {
      return written
    }
  }
}

module.exports = { createJsonOutput }
```

- [ ] **Step 4: Implement `runJsonAudit`**

Create `lib/jsonAudit.js`. Resolve injected or production
`getProjectPackages`, `Marshall`, and `promiseThrottleHelper`. Use this flow:

```js
async function runJsonAudit(cliArgs, dependencies = {}) {
  const getPackages = dependencies.getProjectPackages || getProjectPackages
  const MarshallClass = dependencies.Marshall || Marshall
  const throttle = dependencies.promiseThrottleHelper || promiseThrottleHelper
  let packages = cliArgs.packages || []
  const failures = []

  try {
    if (packages.length === 0) {
      const projectPackages = await getPackages()
      if (projectPackages && projectPackages.error) {
        return buildJsonReport({
          failures: [
            createAuditFailure(
              AUDIT_FAILURE_CODES.PROJECT_MANIFEST_ERROR,
              'Unable to read project package.json'
            )
          ]
        })
      }
      packages = projectPackages
    }

    const marshall = new MarshallClass({
      pkgs: packages,
      progressManager: null,
      promiseThrottleHelper: throttle,
      onAuditFailure: (failure) => failures.push(failure)
    })
    const marshallResults = await marshall.process()
    return buildJsonReport({ packages, marshallResults, failures })
  } catch {
    failures.push(
      createAuditFailure(
        AUDIT_FAILURE_CODES.INTERNAL_ERROR,
        'JSON audit could not complete'
      )
    )
    return buildJsonReport({ packages, failures })
  }
}
```

Export `runJsonAudit` and import the concrete dependencies plus report/failure
helpers at file top.

- [ ] **Step 5: Implement `runJsonCli`**

Create `lib/jsonCli.js` with:

```js
function writeInvalidJsonInvocation(output = createJsonOutput()) {
  const report = buildJsonReport({
    failures: [
      createAuditFailure(
        AUDIT_FAILURE_CODES.INVALID_INPUT,
        'Invalid package or option argument'
      )
    ]
  })
  output.write(report)
  return report
}

async function runJsonCli(cliArgs, dependencies = {}) {
  const output = dependencies.output || createJsonOutput()
  const processTarget = dependencies.processTarget || process
  const audit = dependencies.runJsonAudit || runJsonAudit
  const getExitCode = dependencies.exitCodeForJsonReport || exitCodeForJsonReport
  let interrupted = false
  let interruptedReport

  const interrupt = () => {
    interrupted = true
    interruptedReport = buildJsonReport({
      packages: cliArgs.packages || [],
      failures: [
        createAuditFailure(AUDIT_FAILURE_CODES.INTERRUPTED, 'Audit interrupted')
      ]
    })
    output.write(interruptedReport)
    processTarget.exit(2)
  }

  processTarget.once('SIGINT', interrupt)
  let report
  try {
    report = await audit(cliArgs)
  } catch {
    report = buildJsonReport({
      packages: cliArgs.packages || [],
      failures: [
        createAuditFailure(
          AUDIT_FAILURE_CODES.INTERNAL_ERROR,
          'JSON audit could not complete'
        )
      ]
    })
  }
  processTarget.removeListener('SIGINT', interrupt)

  if (interrupted) {
    return interruptedReport
  }

  output.write(report)
  processTarget.exitCode = getExitCode(report)
  return report
}
```

Add `'use strict'`, required imports, and exports for both functions.

- [ ] **Step 6: Verify and commit**

Run:

```sh
npm test -- --runInBand __tests__/jsonOutput.test.js __tests__/jsonAudit.test.js __tests__/jsonCli.test.js __tests__/sourcePackages.test.js
git add lib/helpers/jsonOutput.js lib/jsonAudit.js lib/jsonCli.js __tests__/jsonOutput.test.js __tests__/jsonAudit.test.js __tests__/jsonCli.test.js
git commit -m "feat: orchestrate non-interactive JSON audits"
```

Expected: tests PASS; SIGINT's later audit completion cannot write a second
document.

### Task 5: Route JSON away from the human/install pipeline

**Files:**
- Modify: `bin/npq.js`
- Modify: `__tests__/cli.test.js`
- Modify: `__tests__/exitCode.test.js`

**Interfaces:**
- Detects raw `--json` before `parseArgsFull()`.
- JSON branch calls only `runJsonCli`.
- Human branch retains the existing Promise chain verbatim.

- [ ] **Step 1: Write failing routing tests**

Add `json: false` to existing CLI argument fixtures. Mock:

```js
jest.mock('../lib/jsonCli', () => ({
  runJsonCli: jest.fn().mockResolvedValue({ status: 'clean' }),
  writeInvalidJsonInvocation: jest.fn()
}))
```

For `json: true` plus explicit install, assert `runJsonCli` is called and
`Spinner`, `prompt`, `autoContinue`, and `pkgMgr.process` are not called.
Set raw argv to include `--json`, make `parseArgsFull` throw, and assert
`writeInvalidJsonInvocation` runs without propagating the raw error.
Spy on `console.log` and `console.error` in the routed JSON case and assert
neither receives npq output. The `jsonOutput` and `jsonCli` tests separately
assert the exact serialized stdout document.

Retain a human `json: false` package-manager exit propagation assertion.

- [ ] **Step 2: Verify failure**

Run: `npm test -- --runInBand __tests__/cli.test.js __tests__/exitCode.test.js`

Expected: FAIL because all invocations use the human pipeline.

- [ ] **Step 3: Add bootstrap and route**

Import `createJsonOutput`, `runJsonCli`, and
`writeInvalidJsonInvocation`. Replace direct parsing with:

```js
const jsonRequested = process.argv.slice(2).includes('--json')
const jsonOutput = jsonRequested ? createJsonOutput() : null
let cliArgs

try {
  cliArgs = CliParser.parseArgsFull()
} catch (error) {
  if (!jsonRequested) throw error
  writeInvalidJsonInvocation(jsonOutput)
  process.exitCode = 2
}
```

Route:

Immediately before the current `const auditOnly` declaration, insert:

```js
if (cliArgs && cliArgs.json) {
  runJsonCli(cliArgs, { output: jsonOutput })
} else if (cliArgs) {
```

Indent the current human audit body one level and append a closing `}` after
the current human `SIGINT` handler. This mechanically encloses the existing
audit-only calculation, spinner setup, Promise chain, catch mapping, and signal
handler without changing any of their statements.

- [ ] **Step 4: Verify JSON isolation**

Run:

```sh
npm test -- --runInBand __tests__/cli.test.js __tests__/exitCode.test.js __tests__/jsonCli.test.js
npm test -- --runInBand __tests__/cli.parser.complete.test.js __tests__/jsonReport.test.js __tests__/marshalls.tasks.test.js __tests__/jsonOutput.test.js __tests__/jsonAudit.test.js __tests__/jsonCli.test.js __tests__/cli.test.js __tests__/exitCode.test.js
```

Expected: PASS; explicit-install JSON never reaches the package manager.

- [ ] **Step 5: Commit**

```sh
git add bin/npq.js __tests__/cli.test.js __tests__/exitCode.test.js
git commit -m "feat(cli): route JSON requests to audit-only output"
```

### Task 6: Ship the schema, document the contract, and verify

**Files:**
- Modify: `package.json`
- Create: `docs/feature/json-output.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/feature/exit-codes.md`

**Interfaces:**
- Publishes: `schema/npq-output-v1.schema.json`.
- Documents: schema, flag behavior, safe failures, and exit codes.

- [ ] **Step 1: Include the schema in npm packages**

Add `"schema/"` to `package.json#files` between `"lib/"` and `"scripts/"`.

- [ ] **Step 2: Create complete feature documentation**

Create `docs/feature/json-output.md` covering:
- `npq express --json`, `npq install express --json`, and project discovery;
- the exact envelope and finding/failure examples from the design spec;
- `clean`/`findings`/`failed` and exits `0`/`1`/`2`;
- all six stable failure codes;
- the shipped schema path;
- ignored/redundant flags and text-only help/version behavior; and
- this CI-safe status capture:

```sh
set +e
report="$(npq install express --json)"
status=$?
set -e
printf '%s\n' "$report"
exit "$status"
```

- [ ] **Step 3: Update public indexes and exit-code reference**

Add to README after `--plain`:

```markdown
### Machine-readable audits

Use `--json` for a non-interactive, audit-only result suitable for CI:

```sh
npq install express --json
```

JSON mode never invokes the package manager. It exits `0` for a clean audit,
`1` for findings, and `2` when the audit cannot complete. See
[JSON audit output](docs/feature/json-output.md).
```

Link the feature from `docs/README.md` Feature Documentation and Quick
Reference. Add a JSON-mode table to `docs/feature/exit-codes.md` and state that
JSON audit-only behavior overrides an explicit `install`.

- [ ] **Step 4: Verify package publication and all checks**

Run:

```sh
npm pack --dry-run --json
npm test -- --runInBand
npm run lint
git diff --check
git status --short
```

Expected:
- pack output contains `schema/npq-output-v1.schema.json`;
- tests meet `jest.config.js` coverage thresholds;
- lint and diff checks pass;
- only intended feature files are changed; and
- pre-existing `.env.development` remains unstaged and untouched.

- [ ] **Step 5: Commit and review release classification**

```sh
git add package.json README.md docs/README.md docs/feature/json-output.md docs/feature/exit-codes.md
git commit -m "docs: document JSON audit output"
git log --oneline -6
```

Expected: `feat:` commits are present so semantic-release classifies the public
addition as minor; the final docs commit succeeds.
