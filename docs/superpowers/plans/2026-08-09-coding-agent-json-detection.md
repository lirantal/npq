# Coding-Agent JSON Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically select npq's existing audit-only JSON mode in recognized coding-agent environments, including install commands intercepted by `npq-hero` while preserving non-install passthrough.

**Architecture:** A pure helper owns all vendor and generic environment signals. Both parsers compute an effective JSON mode before package normalization, and both executable bootstraps route qualifying calls through the existing `runJsonCli()` coordinator so output, safety, schema, and exit-code behavior stay identical to explicit `--json`.

**Tech Stack:** Node.js CommonJS, `node:util.parseArgs`, Jest 30, JSON Schema Draft 2020-12, Changesets.

## Global Constraints

- Supported runtimes remain Node.js `>=24.0.0` and npm `>=11.10.0`.
- Detect exactly `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CURSOR_AGENT`, `PI_CODING_AGENT`, `CODEX_SANDBOX`, `CODEX_THREAD_ID`, `GEMINI_CLI`, `WINDSURF_AGENT`, `CODEIUM_AGENT`, `AGENT`, and `AI_AGENT`.
- A signal is active only when its value is a non-empty string.
- Explicit `npq --json` remains supported and takes the same path as automatic detection.
- Automatically selected JSON mode remains audit-only and must never prompt, count down, start a spinner, or invoke a package manager.
- `npq-hero` selects JSON only for recognized install subcommands; all non-install commands retain passthrough behavior and exit codes.
- Do not add `--no-json` or a public `npq-hero --json` flag.
- Do not change `schema/npq-output-v1.schema.json`, JSON fields, statuses, or exit codes.
- Preserve the user's untracked `.env.development` file and unrelated worktree changes.

---

### Task 1: Centralize coding-agent environment detection

**Files:**
- Create: `lib/helpers/codingAgentEnvironment.js`
- Create: `__tests__/codingAgentEnvironment.test.js`

**Interfaces:**
- Produces: `CODING_AGENT_ENVIRONMENT_VARIABLES: readonly string[]`
- Produces: `isCodingAgentEnvironment(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean`
- Consumes: no project modules and no mutable global state when `env` is provided.

- [ ] **Step 1: Write the failing detector tests**

Create `__tests__/codingAgentEnvironment.test.js`:

```js
'use strict'

const {
  CODING_AGENT_ENVIRONMENT_VARIABLES,
  isCodingAgentEnvironment
} = require('../lib/helpers/codingAgentEnvironment')

const expectedSignals = [
  'CLAUDECODE',
  'CLAUDE_CODE_CHILD_SESSION',
  'CURSOR_AGENT',
  'PI_CODING_AGENT',
  'CODEX_SANDBOX',
  'CODEX_THREAD_ID',
  'GEMINI_CLI',
  'WINDSURF_AGENT',
  'CODEIUM_AGENT',
  'AGENT',
  'AI_AGENT'
]

describe('coding-agent environment detection', () => {
  test('exports the complete supported signal list', () => {
    expect(CODING_AGENT_ENVIRONMENT_VARIABLES).toEqual(expectedSignals)
  })

  test.each(expectedSignals)('detects %s when it is non-empty', (name) => {
    expect(isCodingAgentEnvironment({ [name]: '1' })).toBe(true)
  })

  test('accepts names, paths, and identifiers as signal values', () => {
    expect(isCodingAgentEnvironment({ AGENT: 'amp' })).toBe(true)
    expect(isCodingAgentEnvironment({ CODEX_SANDBOX: '/sandbox/workspace' })).toBe(true)
    expect(isCodingAgentEnvironment({ CODEX_THREAD_ID: 'thread-123' })).toBe(true)
  })

  test.each(expectedSignals)('ignores an empty %s value', (name) => {
    expect(isCodingAgentEnvironment({ [name]: '' })).toBe(false)
  })

  test('ignores missing and unrelated variables', () => {
    expect(isCodingAgentEnvironment({})).toBe(false)
    expect(isCodingAgentEnvironment({ CI: 'true', TERM_PROGRAM: 'vscode' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the detector test and verify it fails**

Run:

```bash
npx jest __tests__/codingAgentEnvironment.test.js --runInBand --coverage=false
```

Expected: FAIL with `Cannot find module '../lib/helpers/codingAgentEnvironment'`.

- [ ] **Step 3: Implement the pure detector**

Create `lib/helpers/codingAgentEnvironment.js`:

```js
'use strict'

const CODING_AGENT_ENVIRONMENT_VARIABLES = Object.freeze([
  'CLAUDECODE',
  'CLAUDE_CODE_CHILD_SESSION',
  'CURSOR_AGENT',
  'PI_CODING_AGENT',
  'CODEX_SANDBOX',
  'CODEX_THREAD_ID',
  'GEMINI_CLI',
  'WINDSURF_AGENT',
  'CODEIUM_AGENT',
  'AGENT',
  'AI_AGENT'
])

function isCodingAgentEnvironment(env = process.env) {
  return CODING_AGENT_ENVIRONMENT_VARIABLES.some(
    (name) => typeof env[name] === 'string' && env[name].length > 0
  )
}

module.exports = { CODING_AGENT_ENVIRONMENT_VARIABLES, isCodingAgentEnvironment }
```

- [ ] **Step 4: Run the detector test and verify it passes**

Run:

```bash
npx jest __tests__/codingAgentEnvironment.test.js --runInBand --coverage=false
```

Expected: PASS with 25 tests: one signal-list test, eleven active-signal cases, one value-shape test, eleven empty-signal cases, and one unrelated-variable test.

- [ ] **Step 5: Commit the detector**

```bash
git add lib/helpers/codingAgentEnvironment.js __tests__/codingAgentEnvironment.test.js
git commit -m "feat: detect coding-agent environments"
```

---

### Task 2: Make both parsers compute effective JSON mode

**Files:**
- Modify: `lib/cli.js:3-8,71-169`
- Modify: `__tests__/cli.parser.complete.test.js:1-25,210-390,491-549`
- Modify: `__tests__/cli.packageManagerArgs.test.js:1-175`

**Interfaces:**
- Consumes: `isCodingAgentEnvironment(env): boolean` from Task 1.
- Preserves: `CliParser.parseArgsFull(): { packages, packageManager, dryRun, plain, json, disableAutoContinue, registryConfigArgs, installSubcommandExplicit }`.
- Extends: `CliParser.parseArgsMinimal(options?)` returns `{ packages, registryConfigArgs, installSubcommandExplicit, json }`.
- Produces: thrown JSON package errors from qualifying `npq-hero` installs have non-enumerable `npqJsonMode === true`, allowing the executable to choose the sanitized JSON failure path without treating non-install parser failures as JSON.

- [ ] **Step 1: Make parser tests deterministic under ambient agent variables**

Before requiring `CliParser` in both parser test files, mock the detector and default it to human mode:

```js
const mockIsCodingAgentEnvironment = jest.fn()
jest.mock('../lib/helpers/codingAgentEnvironment', () => ({
  isCodingAgentEnvironment: mockIsCodingAgentEnvironment
}))

beforeEach(() => {
  mockIsCodingAgentEnvironment.mockReset()
  mockIsCodingAgentEnvironment.mockReturnValue(false)
})
```

Keep the existing setup in each `beforeEach`; add the two detector lines to it rather than creating a second hook when one already exists.

- [ ] **Step 2: Write failing full-parser tests for automatic JSON mode**

Add these cases to `parseArgsFull` coverage:

```js
test('enables JSON mode in a coding-agent environment', () => {
  mockIsCodingAgentEnvironment.mockReturnValue(true)
  mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

  expect(CliParser.parseArgsFull()).toEqual(
    expect.objectContaining({ packages: ['express@latest'], json: true })
  )
})

test('uses JSON-safe package parsing when detection enables JSON mode', () => {
  mockIsCodingAgentEnvironment.mockReturnValue(true)
  mockParseArgs.mockReturnValue({
    values: {},
    positionals: ['install', 'https://user:credential@example.test/package.tgz']
  })

  expect(() => CliParser.parseArgsFull()).toThrow('Invalid JSON package input')
})

test('keeps explicit JSON mode when no coding agent is detected', () => {
  mockParseArgs.mockReturnValue({
    values: { json: true },
    positionals: ['install', 'express']
  })

  expect(CliParser.parseArgsFull().json).toBe(true)
})
```

- [ ] **Step 3: Write failing minimal-parser tests for the hero boundary**

Add these cases to `parseArgsMinimal` coverage:

```js
test('enables JSON only for an agent-driven install command', () => {
  mockIsCodingAgentEnvironment.mockReturnValue(true)
  mockParseArgs.mockReturnValue({ values: {}, positionals: ['install', 'express'] })

  expect(CliParser.parseArgsMinimal()).toEqual({
    packages: ['express@latest'],
    registryConfigArgs: [],
    installSubcommandExplicit: true,
    json: true
  })
})

test('keeps agent-driven non-install commands in passthrough mode', () => {
  mockIsCodingAgentEnvironment.mockReturnValue(true)
  mockParseArgs.mockReturnValue({ values: {}, positionals: ['run', 'build'] })

  expect(CliParser.parseArgsMinimal()).toEqual({
    packages: [],
    registryConfigArgs: [],
    installSubcommandExplicit: false,
    json: false
  })
})

test('marks invalid agent install input for safe JSON error routing', () => {
  mockIsCodingAgentEnvironment.mockReturnValue(true)
  mockParseArgs.mockReturnValue({
    values: {},
    positionals: ['install', 'https://user:credential@example.test/package.tgz']
  })

  expect.assertions(2)
  try {
    CliParser.parseArgsMinimal()
  } catch (error) {
    expect(error.message).toBe('Invalid JSON package input')
    expect(error.npqJsonMode).toBe(true)
  }
})

test('preserves human parsing for install package types outside JSON mode', () => {
  mockParseArgs.mockReturnValue({
    values: {},
    positionals: ['install', 'https://example.test/package.tgz']
  })

  expect(() => CliParser.parseArgsMinimal()).not.toThrow()
})
```

Update the three existing exact minimal-parser expectations in `__tests__/cli.parser.complete.test.js` and the registry-composition expectation in `__tests__/cli.packageManagerArgs.test.js` to include:

```js
installSubcommandExplicit: true,
json: false
```

Use `installSubcommandExplicit: false` for the existing non-install and empty-positionals expectations.

- [ ] **Step 4: Run parser tests and verify the new assertions fail**

Run:

```bash
npx jest __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js --runInBand --coverage=false
```

Expected: FAIL because `json` still only follows `values.json`, minimal results lack `installSubcommandExplicit` and `json`, and agent-mode tarball input is still parsed by `npm-package-arg`.

- [ ] **Step 5: Implement effective mode selection in `lib/cli.js`**

Import the Task 1 helper:

```js
const { isCodingAgentEnvironment } = require('./helpers/codingAgentEnvironment')
```

In `parseArgsFull()`, after help/version early exits and before package normalization, compute and reuse one effective value:

```js
const json = values.json === true || isCodingAgentEnvironment()
const normalizedPackages = this._extractPackagesFromPositionals(positionals, false, json)
```

Return `json` instead of `values.json || false`.

Replace `parseArgsMinimal()` with:

```js
static parseArgsMinimal({ codingAgentEnvironment = isCodingAgentEnvironment() } = {}) {
  const packageManager = process.env.NPQ_PKG_MGR || 'npm'
  const { values, positionals } = parsePackageManagerArguments({
    packageManager,
    args: process.argv.slice(2)
  })
  const installSubcommandExplicit =
    positionals.length > 0 && this.isInstallSubcommand(positionals[0])
  const json = codingAgentEnvironment && installSubcommandExplicit
  let normalizedPackages

  try {
    normalizedPackages = this._extractPackagesFromPositionals(positionals, true, json)
  } catch (error) {
    if (json && error && typeof error === 'object') {
      Object.defineProperty(error, 'npqJsonMode', { value: true })
    }
    throw error
  }

  return {
    packages: normalizedPackages,
    registryConfigArgs: this.registryConfigArgs(values),
    installSubcommandExplicit,
    json
  }
}
```

- [ ] **Step 6: Run all parser tests**

Run:

```bash
npx jest __tests__/codingAgentEnvironment.test.js __tests__/cli.parser.complete.test.js __tests__/cli.parser.test.js __tests__/cli.packageManagerArgs.test.js --runInBand --coverage=false
```

Expected: PASS. Existing pnpm filter placement cases must still identify `add`/`install` correctly and must not treat `run install` or `exec install` as install commands.

- [ ] **Step 7: Commit parser integration**

```bash
git add lib/cli.js __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js
git commit -m "feat: default parsers to JSON for coding agents"
```

---

### Task 3: Route automatic mode through both executable pipelines

**Files:**
- Modify: `bin/npq.js:18-38`
- Modify: `bin/npq-hero.js:8-139`
- Modify: `__tests__/cli.test.js:1-318`
- Create: `__tests__/npqHero.test.js`
- Create: `__tests__/codingAgentCli.process.test.js`

**Interfaces:**
- Consumes: `isCodingAgentEnvironment()`, `CliParser.parseArgsFull()`, and `CliParser.parseArgsMinimal({ codingAgentEnvironment })`.
- Consumes: `runJsonCli(cliArgs, { output })`, `writeInvalidJsonInvocation(output)`, and `createJsonOutput()` from the existing JSON implementation.
- Preserves: the complete existing human pipelines and `npq-hero` non-install package-manager passthrough.

- [ ] **Step 1: Add a failing standalone bootstrap-routing test**

Mock detection in `__tests__/cli.test.js` so existing tests always default to `false`:

```js
const mockIsCodingAgentEnvironment = jest.fn()
jest.mock('../lib/helpers/codingAgentEnvironment', () => ({
  isCodingAgentEnvironment: mockIsCodingAgentEnvironment
}))
```

Reset it to `false` in `beforeEach`, then add:

```js
test('creates JSON output for an automatically detected coding agent', async () => {
  const { CliParser } = require('../lib/cli')
  const { runJsonCli } = require('../lib/jsonCli')
  const cliArgs = {
    packages: ['express@latest'],
    json: true,
    installSubcommandExplicit: true
  }
  mockIsCodingAgentEnvironment.mockReturnValue(true)
  CliParser.parseArgsFull.mockReturnValue(cliArgs)

  require('../bin/npq.js')
  await new Promise(process.nextTick)

  expect(runJsonCli).toHaveBeenCalledWith(cliArgs, {
    output: expect.objectContaining({ write: expect.any(Function) })
  })
})
```

- [ ] **Step 2: Add failing `npq-hero` routing tests**

Create `__tests__/npqHero.test.js` with explicit mocks for `cliSupportHandler` (supported, non-interactive), `codingAgentEnvironment` (detected), `CliParser.parseArgsMinimal`, `createJsonOutput`, `runJsonCli`, `writeInvalidJsonInvocation`, `Spinner`, `Marshall`, `reportResults`, `cliPrompt`, `RegistryConfig`, `RegistryClient`, and `packageManager.process`. Use `let` bindings for these mocked modules; after `jest.resetModules()` in each `beforeEach`, require and assign the fresh mocks before loading the binary. Reset `process.argv` and `process.exitCode` before each test and restore both afterward. Cover these exact cases:

```js
test('routes an agent install through JSON without invoking the package manager', async () => {
  const cliArgs = {
    packages: ['express@latest'],
    registryConfigArgs: [],
    installSubcommandExplicit: true,
    json: true
  }
  CliParser.parseArgsMinimal.mockReturnValue(cliArgs)

  require('../bin/npq-hero.js')
  await new Promise(process.nextTick)

  expect(runJsonCli).toHaveBeenCalledWith(cliArgs, {
    output: expect.objectContaining({ write: expect.any(Function) })
  })
  expect(packageManager.process).not.toHaveBeenCalled()
  expect(Spinner).not.toHaveBeenCalled()
  expect(cliPrompt.prompt).not.toHaveBeenCalled()
  expect(cliPrompt.autoContinue).not.toHaveBeenCalled()
})

test('keeps an agent non-install command in the human passthrough pipeline', async () => {
  CliParser.parseArgsMinimal.mockReturnValue({
    packages: [],
    registryConfigArgs: [],
    installSubcommandExplicit: false,
    json: false
  })

  require('../bin/npq-hero.js')
  await new Promise(setImmediate)

  expect(runJsonCli).not.toHaveBeenCalled()
  expect(packageManager.process).toHaveBeenCalled()
})

test('sanitizes a marked agent-install parser failure', () => {
  const parserError = Object.assign(new Error('credential in raw input'), {
    npqJsonMode: true
  })
  CliParser.parseArgsMinimal.mockImplementation(() => {
    throw parserError
  })

  expect(() => require('../bin/npq-hero.js')).not.toThrow()
  expect(writeInvalidJsonInvocation).toHaveBeenCalledWith(
    expect.objectContaining({ write: expect.any(Function) })
  )
  expect(process.exitCode).toBe(2)
})
```

The test file must snapshot and restore `process.argv`, `process.exitCode`, and listeners introduced during module loading, following `__tests__/cli.test.js`.

- [ ] **Step 3: Run the executable unit tests and verify they fail**

Run:

```bash
npx jest __tests__/cli.test.js __tests__/npqHero.test.js --runInBand --coverage=false
```

Expected: FAIL because standalone bootstrap creates JSON output only for raw `--json`, and `npq-hero` has no JSON routing or marked-error handling.

- [ ] **Step 4: Update standalone `npq` bootstrap detection**

In `bin/npq.js`, import the detector and replace the raw check:

```js
const { isCodingAgentEnvironment } = require('../lib/helpers/codingAgentEnvironment')

const jsonRequested =
  process.argv.slice(2).includes('--json') || isCodingAgentEnvironment()
const jsonOutput = jsonRequested ? createJsonOutput() : null
```

Do not change help/version behavior or the existing `cliArgs.json` routing branch.

- [ ] **Step 5: Add `npq-hero` JSON bootstrap and preserve the human block**

Import:

```js
const { createJsonOutput } = require('../lib/helpers/jsonOutput')
const { runJsonCli, writeInvalidJsonInvocation } = require('../lib/jsonCli')
const { isCodingAgentEnvironment } = require('../lib/helpers/codingAgentEnvironment')
```

Replace the direct `const cliArgs = CliParser.parseArgsMinimal()` call with:

```js
const codingAgentEnvironment = isCodingAgentEnvironment()
let cliArgs

try {
  cliArgs = CliParser.parseArgsMinimal({ codingAgentEnvironment })
} catch (error) {
  if (!error || error.npqJsonMode !== true) throw error
  writeInvalidJsonInvocation(createJsonOutput())
  process.exitCode = 2
}

if (cliArgs && cliArgs.json) {
  runJsonCli(cliArgs, { output: createJsonOutput() })
} else if (cliArgs) {
```

Move the existing unchanged human block, beginning with
`const silentModeNoPackages` and ending with its final `.catch(...)`, inside the
`else if (cliArgs)` block and close that block after the promise chain. This is
a structural wrap only: retain existing registry loading, marshall reporting,
prompts, package-manager invocation, and exit-code propagation byte-for-byte
apart from indentation.

- [ ] **Step 6: Run executable unit tests and verify they pass**

Run:

```bash
npx jest __tests__/cli.test.js __tests__/npqHero.test.js __tests__/exitCode.test.js --runInBand --coverage=false
```

Expected: PASS. The existing `npq-hero` exit-code tests must still propagate
the package manager's `0`, `1`, and other non-zero results.

- [ ] **Step 7: Add process-level contract tests for real environment variables**

Create `__tests__/codingAgentCli.process.test.js`. Import
`CODING_AGENT_ENVIRONMENT_VARIABLES`, remove all of them from a copied child
environment, then add only the signal under test. Reuse
`__tests__/__fixtures__/json-process-preload.js` so audits stay deterministic.

Use this environment helper:

```js
function childEnvironment(signal, scenario = 'clean') {
  const env = { ...process.env }
  for (const name of CODING_AGENT_ENVIRONMENT_VARIABLES) delete env[name]
  env[signal.name] = signal.value
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require=${preload}`.trim()
  env.NPQ_JSON_TEST_SCENARIO = scenario
  env.NPQ_PKG_MGR = `"${process.execPath}" -e "require('node:fs').writeFileSync('${packageManagerMarker}', 'ran')"`
  return env
}
```

Use `spawnSync(process.execPath, [binary, ...args], { cwd, env, encoding: 'utf8' })`
and assert these contracts:

```js
test.each([
  { name: 'CLAUDECODE', value: '1' },
  { name: 'CODEX_THREAD_ID', value: 'thread-123' },
  { name: 'AGENT', value: 'amp' },
  { name: 'AI_AGENT', value: 'true' }
])('npq emits JSON when $name is present', (signal) => {
  const result = run(npqBinary, ['install', 'express'], signal)
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(JSON.parse(result.stdout).status).toBe('clean')
  expect(packageManagerRan()).toBe(false)
})

test('npq-hero audits an agent install without passthrough', () => {
  const result = run(heroBinary, ['install', 'express'], {
    name: 'CURSOR_AGENT',
    value: '1'
  })
  expect(JSON.parse(result.stdout).packages[0].requested).toBe('express@latest')
  expect(packageManagerRan()).toBe(false)
})

test('npq-hero audits project dependencies for an agent install without operands', () => {
  writeProject({ dependencies: { express: '^5.0.0' } })
  const result = run(heroBinary, ['install'], { name: 'GEMINI_CLI', value: '1' })
  expect(JSON.parse(result.stdout).packages[0].requested).toBe('express@^5.0.0')
  expect(packageManagerRan()).toBe(false)
})

test('npq-hero preserves non-install passthrough under agent detection', () => {
  const result = run(heroBinary, ['run', 'build'], { name: 'AGENT', value: 'goose' })
  expect(result.status).toBe(0)
  expect(packageManagerRan()).toBe(true)
})
```

Also add an invalid-tarball case for agent-mode `npq-hero` and assert exit `2`,
one parseable `INVALID_INPUT` JSON document, empty stderr, no package-manager
marker, and absence of `credential` and the raw URL in combined output.

- [ ] **Step 8: Run the complete automatic-routing test set**

Run:

```bash
npx jest __tests__/codingAgentEnvironment.test.js __tests__/cli.parser.complete.test.js __tests__/cli.packageManagerArgs.test.js __tests__/cli.test.js __tests__/npqHero.test.js __tests__/codingAgentCli.process.test.js __tests__/jsonCli.process.test.js __tests__/exitCode.test.js --runInBand --coverage=false
```

Expected: PASS with every spawned JSON document parsing successfully and every
non-install hero case creating the package-manager marker.

- [ ] **Step 9: Commit executable routing**

```bash
git add bin/npq.js bin/npq-hero.js __tests__/cli.test.js __tests__/npqHero.test.js __tests__/codingAgentCli.process.test.js
git commit -m "feat: default coding-agent audits to JSON"
```

---

### Task 4: Document automatic detection and add the release note

**Files:**
- Modify: `README.md:180-205`
- Modify: `docs/feature/json-output.md:1-38`
- Modify: `docs/feature/alias.md:12-38,130-175`
- Create: `.changeset/agent-json-output.md`

**Interfaces:**
- Documents: the exact signal list and non-empty-value rule from Task 1.
- Documents: `npq-hero` install-only JSON boundary and unchanged non-install passthrough.
- Preserves: the existing JSON schema and exit-code documentation.

- [ ] **Step 1: Add a concise README note**

Immediately after the explicit `--json` example, add:

```markdown
When npq detects a supported coding-agent environment, it automatically uses
the same audit-only JSON mode. This applies to `npq` and to install commands
intercepted by `npq-hero`; non-install `npq-hero` commands still pass through to
the configured package manager. See [JSON audit output](docs/feature/json-output.md#coding-agent-detection).
```

- [ ] **Step 2: Add the full JSON-output documentation section**

Add `## Coding-agent detection` after the opening JSON audit examples in
`docs/feature/json-output.md`. State that a non-empty value in any of the eleven
signals selects the exact existing JSON pipeline, list every signal in a table,
and include these examples:

```sh
CLAUDECODE=1 npq install express
AGENT=goose npq express
AI_AGENT=true npq-hero install express
```

State explicitly that these commands are audit-only, `npq --help` and
`npq --version` remain text, and the v1 schema does not expose agent identity.

- [ ] **Step 3: Document the alias boundary**

In `docs/feature/alias.md`, add a subsection named
`### Coding-agent install audits` with this exact behavior table:

```markdown
| Invocation under a detected agent | Behavior |
| --- | --- |
| `npq-hero install express` | Emit the JSON audit and do not install. |
| `npq-hero install` | Audit current project dependencies as JSON and do not install. |
| `npq-hero test` | Pass through to the package manager. |
| `npq-hero run build` | Pass through to the package manager. |
```

Clarify that `npq-hero` still has no flags of its own and does not expose a
public `--json` option.

- [ ] **Step 4: Add a minor Changeset**

Create `.changeset/agent-json-output.md`:

```markdown
---
'npq': minor
---

Automatically emit audit-only JSON when npq detects a coding-agent environment,
including install commands intercepted by npq-hero while preserving non-install
package-manager passthrough.
```

- [ ] **Step 5: Verify documentation, formatting, and the complete repository**

Run:

```bash
git diff --check
npm run lint
npm test -- --runInBand
```

Expected: `git diff --check` exits `0`; ESLint and lockfile lint pass; all Jest
suites pass with global coverage at or above the configured 75% thresholds.

- [ ] **Step 6: Commit documentation and release metadata**

```bash
git add README.md docs/feature/json-output.md docs/feature/alias.md .changeset/agent-json-output.md
git commit -m "docs: explain coding-agent JSON audits"
```

---

## Final review checklist

- [ ] `git status --short` shows only intentional implementation files and the pre-existing untracked `.env.development`.
- [ ] Every environment signal in the approved design appears exactly once in the production constant and in user-facing documentation.
- [ ] Empty signal values leave both executables in their existing human behavior.
- [ ] Agent-mode `npq` and agent install-mode `npq-hero` emit exactly one schema-v1 JSON document and never invoke a package manager.
- [ ] Agent-mode non-install `npq-hero` commands preserve passthrough arguments and exit codes.
- [ ] Explicit `npq --json`, human `npq`, and human `npq-hero` regression tests pass.
- [ ] `schema/npq-output-v1.schema.json` is unchanged.
- [ ] The Changeset is included and describes both executables.
- [ ] The eventual PR includes `Related issues` with `Fixes: #426` and ends its title with `🤖🤖🤖` if opened by an automated agent.
