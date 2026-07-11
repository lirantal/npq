# Custom Registry Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make npq audit packages through authenticated default or scoped registries selected by standard npm configuration, without silently falling back to npmjs.

**Architecture:** Load npm-compatible configuration once with `@npmcli/config`, pass its flattened options to a single `RegistryClient` built on `npm-registry-fetch`, and inject that client through the CLI, `Marshall`, metadata helpers, and registry-dependent marshalls. Represent unavailable optional registry services with a visible `notEvaluated` result, while configuration, authentication, transport, and protocol failures abort the audit.

**Tech Stack:** CommonJS on Node.js 24, npm 11.10 or newer, Jest 30, `@npmcli/config@^10.8.1`, `npm-registry-fetch@^19.1.1`, existing `npm-package-arg`, `semver`, `sigstore`, and `ssri`.

## Global Constraints

- Preserve the existing default registry `https://registry.npmjs.org/`.
- Standard configuration precedence is CLI, environment, project, user, global, then npm-compatible defaults.
- Support default and scoped registries, registry-scoped authentication, proxy, CA, client certificate, and strict-TLS settings.
- Do not add `NPQ_REGISTRY`, `--npq-registry`, native `.yarnrc.yml` parsing, Artifactory administration APIs, or registry-specific analytics.
- A package assigned to a custom registry must cause zero package-registry or download requests to npmjs.
- Never send authentication material to a registry host or path that does not match its npm configuration scope.
- Optional signing-key, attestation, and download-service absence is visible as `notEvaluated` and does not affect warning/error counts, prompts, auto-continue, or exit status.
- Authentication, TLS, proxy, DNS, timeout, server, malformed metadata, malformed optional responses, and invalid configuration failures abort the audit.
- Preserve current package-level signature, provenance, provenance-regression, and download-count severities when their required services are available.
- Every behavior change is test-first, and every task ends in an independently reviewable Conventional Commit.

---

## File Structure

### New runtime files

- `lib/helpers/notEvaluated.js` — typed signal for checks that cannot run because a registry capability is absent.
- `lib/helpers/registryErrors.js` — fatal registry error type plus registry URL sanitization.
- `lib/helpers/registryConfig.js` — npm configuration loading, validation, precedence, flattening, and package-specific registry selection.
- `lib/helpers/registryClient.js` — the only npm-registry HTTP client; owns metadata, keys, attestation, download, and capability-cache behavior.

### New test files

- `__tests__/__fixtures__/fatalRegistry.marshall.js` — deterministic fatal registry marshall for task-runner propagation tests.
- `__tests__/registryConfig.test.js` — real temporary `.npmrc` hierarchy and option-flattening tests.
- `__tests__/registryClient.test.js` — mocked transport tests for routing, auth isolation, failure classification, capability caching, and redaction.
- `__tests__/customRegistry.integration.test.js` — configuration-to-client-to-marshall integration without live network access.

### Existing runtime files to modify

- `package.json`, `package-lock.json` — add the two maintained npm runtime libraries.
- `lib/cli.js` — parse supported standard registry flags and expose isolated config arguments.
- `bin/npq.js`, `bin/npq-hero.js` — load registry configuration before constructing `Marshall`; print skipped checks without treating them as findings.
- `lib/marshall.js` — accept/inject one `RegistryClient`.
- `lib/helpers/packageRepoUtils.js` — delegate registry network work and key caches by registry plus package.
- `lib/helpers/npmRegistry.js` — retain cryptographic verification only; accept fetched attestations.
- `lib/marshalls/baseMarshall.js` — record `notEvaluated` and rethrow fatal registry failures.
- `lib/marshalls/index.js` — inject the registry client and propagate fatal registry failures.
- `lib/marshalls/signatures.marshall.js`, `lib/marshalls/provenance.marshall.js` — use the injected client and remove hard-coded endpoints.
- `lib/helpers/reportResults.js` — aggregate and render `notEvaluated` without changing warning/error totals.

### Existing tests to modify

- `__tests__/cli.parser.complete.test.js`, `__tests__/cli.test.js`, `__tests__/exitCode.test.js` — registry arguments, startup loading, output, prompts, and exit behavior.
- `__tests__/packageManager.test.js` — standard registry flags remain forwarded to the package manager.
- `__tests__/packageRepoUtils.test.js` — registry-client delegation and cache isolation.
- `__tests__/npmRegistry.test.js` — verification-only interface.
- `__tests__/marshalls.base.test.js`, `__tests__/marshalls.tasks.test.js` — skipped and fatal result propagation.
- `__tests__/marshalls.signatures.test.js`, `__tests__/marshalls.provenance.test.js`, `__tests__/marshalls.downloads.test.js` — injected client behavior.
- `__tests__/reportResults.test.js` — visible skipped checks and unchanged finding counts.

### Documentation and release files

- `docs/feature/custom-registry.md` — user-facing setup, behavior, security, and limitations.
- `README.md`, `docs/README.md` — link and summarize the feature.
- `.changeset/bright-tools-audit.md` — minor release note required by `RELEASE.md`.

---

### Task 1: Add skipped-check and fatal-registry result primitives

**Files:**
- Create: `lib/helpers/notEvaluated.js`
- Create: `lib/helpers/registryErrors.js`
- Create: `__tests__/__fixtures__/fatalRegistry.marshall.js`
- Modify: `lib/marshalls/baseMarshall.js:1-62`
- Modify: `lib/marshalls/index.js:20-49`
- Modify: `lib/helpers/reportResults.js:82-307`
- Test: `__tests__/marshalls.base.test.js`
- Test: `__tests__/marshalls.tasks.test.js`
- Test: `__tests__/reportResults.test.js`

**Interfaces:**
- Produces: `new NotEvaluated(message, { capability })`.
- Produces: `new RegistryError(message, { registry, code, statusCode, cause })`.
- Produces: `sanitizeRegistryUrl(value): string`.
- Produces: marshall results with `notEvaluated: Array<{pkg, message}>`.
- Produces: report output with `countNotEvaluated: number`; warning and error counts remain independent.

- [ ] **Step 1: Write failing BaseMarshall and task-propagation tests**

Append these cases to `__tests__/marshalls.base.test.js`:

```js
test('checkPackage records NotEvaluated separately from findings', async () => {
  const NotEvaluated = require('../lib/helpers/notEvaluated')
  const marshall = new BaseMarshall({ packageRepoUtils: null })
  marshall.name = 'optional'
  marshall.validate = jest.fn().mockRejectedValue(
    new NotEvaluated('configured registry does not expose signing keys', {
      capability: 'signing-keys'
    })
  )
  const ctx = { pkgs: [], marshalls: {} }
  marshall.init(ctx)

  await marshall.checkPackage({ packageString: 'private-package@1.0.0' }, ctx)

  expect(ctx.marshalls.optional.errors).toEqual([])
  expect(ctx.marshalls.optional.warnings).toEqual([])
  expect(ctx.marshalls.optional.notEvaluated).toEqual([
    {
      pkg: 'private-package@1.0.0',
      message: 'configured registry does not expose signing keys'
    }
  ])
})

test('checkPackage rethrows fatal RegistryError', async () => {
  const { RegistryError } = require('../lib/helpers/registryErrors')
  const marshall = new BaseMarshall({ packageRepoUtils: null })
  marshall.name = 'optional'
  marshall.validate = jest.fn().mockRejectedValue(
    new RegistryError('Registry authentication failed', {
      registry: 'https://user:secret@artifactory.example.test/api/npm/npm/',
      code: 'EREGISTRYAUTH',
      statusCode: 401
    })
  )
  const ctx = { pkgs: [], marshalls: {} }
  marshall.init(ctx)

  await expect(
    marshall.checkPackage({ packageString: 'private-package@1.0.0' }, ctx)
  ).rejects.toMatchObject({ code: 'EREGISTRYAUTH', statusCode: 401 })
})
```

Create `__tests__/__fixtures__/fatalRegistry.marshall.js`:

```js
'use strict'

const BaseMarshall = require('../../lib/marshalls/baseMarshall')
const { RegistryError } = require('../../lib/helpers/registryErrors')

class FatalRegistryMarshall extends BaseMarshall {
  constructor(options) {
    super(options)
    this.name = 'fatal-registry'
  }

  title() {
    return 'Testing fatal registry propagation'
  }

  validate() {
    return Promise.reject(
      new RegistryError('Registry network request failed', {
        registry: 'https://artifactory.example.test/api/npm/npm/',
        code: 'EREGISTRYNETWORK'
      })
    )
  }
}

module.exports = FatalRegistryMarshall
```

In `__tests__/marshalls.tasks.test.js`, use:

```js
marshalls.collectMarshalls = jest.fn().mockResolvedValue([
  path.join(
    process.cwd(),
    '__tests__/__fixtures__/fatalRegistry.marshall.js'
  )
])
const config = {
  pkgs: [{ packageName: 'private-package', packageString: 'private-package@1.0.0' }],
  packageRepoUtils: new PackageRepoUtilsMock()
}

await expect(marshalls.tasks(config)).rejects.toMatchObject({
  name: 'RegistryError',
  code: 'EREGISTRYNETWORK'
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- --runInBand __tests__/marshalls.base.test.js __tests__/marshalls.tasks.test.js
```

Expected: FAIL because `notEvaluated`, `NotEvaluated`, and `RegistryError` do not exist.

- [ ] **Step 3: Add the two error primitives**

Create `lib/helpers/notEvaluated.js`:

```js
'use strict'

class NotEvaluated extends Error {
  constructor(message, { capability = null } = {}) {
    super(message)
    this.name = 'NotEvaluated'
    this.capability = capability
  }
}

module.exports = NotEvaluated
```

Create `lib/helpers/registryErrors.js`:

```js
'use strict'

function sanitizeRegistryUrl(value) {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return 'configured registry'
  }
}

class RegistryError extends Error {
  constructor(
    message,
    { registry = null, code = 'EREGISTRY', statusCode = null, cause = null } = {}
  ) {
    const sanitizedRegistry = registry ? sanitizeRegistryUrl(registry) : null
    super(sanitizedRegistry ? `${message} (${sanitizedRegistry})` : message, {
      cause: cause || undefined
    })
    this.name = 'RegistryError'
    this.code = code
    this.statusCode = statusCode
    this.registry = sanitizedRegistry
  }
}

module.exports = { RegistryError, sanitizeRegistryUrl }
```

- [ ] **Step 4: Teach BaseMarshall and the task runner the new states**

In `BaseMarshall.init()`, initialize:

```js
notEvaluated: [],
```

Replace `BaseMarshall.checkPackage()` with:

```js
checkPackage(pkg, ctx) {
  return this.validate(pkg)
    .then((data) => {
      ctx.marshalls[this.name].data[pkg.packageString] = data
      return data
    })
    .catch((err) => {
      const NotEvaluated = require('../helpers/notEvaluated')
      const { RegistryError } = require('../helpers/registryErrors')

      if (err instanceof RegistryError) {
        throw err
      }

      const message = {
        pkg: pkg.packageString,
        message: err.message
      }

      if (err instanceof NotEvaluated) {
        this.setNotEvaluated(message)
        return undefined
      }

      this.setMessage(message, Boolean(err instanceof Warning))
      return undefined
    })
}

setNotEvaluated(msg) {
  this.ctx.marshalls[this.name].notEvaluated.push({
    pkg: msg.pkg,
    message: msg.message
  })
}
```

Move the two new `require` calls to the import section after the tests pass, preserving the method body shown above without dynamic imports.

In the `Marshalls.tasks()` marshall-execution catch block, add fatal propagation:

```js
} catch (error) {
  if (error instanceof RegistryError) {
    throw error
  }
  console.error(`Error running task ${marshall.title}:`, error)
}
```

Import `RegistryError` once at the top of `lib/marshalls/index.js`. Add `notEvaluated: []` to the synthetic `not_found` result so every marshall result has the same shape.

- [ ] **Step 5: Add failing report tests for visible skipped checks**

Add a report fixture containing only:

```js
const skippedOnlyResults = {
  'private-package@1.0.0': [
    {
      signatures: {
        status: null,
        errors: [],
        warnings: [],
        notEvaluated: [
          {
            pkg: 'private-package@1.0.0',
            message: 'configured registry does not expose signing keys'
          }
        ],
        data: {},
        marshall: 'signatures',
        categoryId: 'SupplyChainSecurity'
      }
    }
  ]
}
```

Assert:

```js
const result = reportResults(skippedOnlyResults, { plain: true })
expect(result.countErrors).toBe(0)
expect(result.countWarnings).toBe(0)
expect(result.countNotEvaluated).toBe(1)
expect(result.resultsForPlainTextPrint).toContain(
  'NOT EVALUATED: Supply Chain Security - configured registry does not expose signing keys'
)
expect(result.summaryForPlainTextPrint).toContain('Total not evaluated: 1')
```

- [ ] **Step 6: Implement report aggregation and rendering**

Initialize `countNotEvaluated = 0`. Add `notEvaluated: []` to each package created by `marshallResultsToIssuesPerPackage()`. Map marshall entries exactly like warnings:

```js
if (value.notEvaluated && value.notEvaluated.length > 0) {
  const skippedChecks = value.notEvaluated.map((entry) => ({
    marshall: value.marshall,
    categoryId: value.categoryId,
    categoryFriendlyName: marshallCategories[value.categoryId].title,
    ...entry
  }))
  issues.notEvaluated.push(skippedChecks)
}
```

Retain packages when any of errors, warnings, or skipped checks exist:

```js
if (
  issues.errors.length > 0 ||
  issues.warnings.length > 0 ||
  issues.notEvaluated.length > 0
) {
  issuesPerPackage.push(issues)
}
```

Render skipped checks after warnings using a cyan `○` in rich output and this stable plain-text format:

```js
if (result.notEvaluated && result.notEvaluated.length > 0) {
  result.notEvaluated.forEach((entryArray) => {
    countNotEvaluated += entryArray.length
    entryArray.forEach((entry) => {
      const topicRich = styleText(
        ['cyan'],
        entry.categoryFriendlyName.padEnd(maxTextLength, ' ')
      )
      const iconRich = styleText(['cyan'], '○')
      const wrappedMessage = wrapTextWithIndent(
        entry.message,
        maxMessageWidth,
        indentString
      )
      resultsForPrettyPrint +=
        `\n ${prefixRich} ${iconRich} ${topicRich} ${separatorRich} ${wrappedMessage} `
      resultsForPlainTextPrint +=
        `\n  NOT EVALUATED: ${entry.categoryFriendlyName} - ${entry.message}`
    })
  })
}
```

Add `Total not evaluated` to both summaries and return `countNotEvaluated`.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test -- --runInBand __tests__/marshalls.base.test.js __tests__/marshalls.tasks.test.js __tests__/reportResults.test.js
```

Expected: PASS.

Commit:

```bash
git add lib/helpers/notEvaluated.js lib/helpers/registryErrors.js lib/marshalls/baseMarshall.js lib/marshalls/index.js lib/helpers/reportResults.js __tests__/__fixtures__/fatalRegistry.marshall.js __tests__/marshalls.base.test.js __tests__/marshalls.tasks.test.js __tests__/reportResults.test.js
git commit -m "feat: represent registry checks that cannot be evaluated"
```

---

### Task 2: Load standard npm registry configuration

**Files:**
- Create: `lib/helpers/registryConfig.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lib/cli.js:63-153`
- Test: `__tests__/registryConfig.test.js`
- Test: `__tests__/cli.parser.complete.test.js`

**Interfaces:**
- Produces: `RegistryConfig.load({ argv, env, cwd }): Promise<RegistryConfig>`.
- Produces: `RegistryConfig.defaults(): RegistryConfig`.
- Produces: `registryConfig.requestOptions: Readonly<object>`.
- Produces: `registryConfig.registryFor(packageSpec): string`.
- Produces: `registryConfig.describeRegistry(packageSpec): string`.
- Produces: `cliArgs.registryConfigArgs: string[]` for both parsers.

- [ ] **Step 1: Install exact compatible dependency ranges**

Run:

```bash
npm install '@npmcli/config@^10.8.1' 'npm-registry-fetch@^19.1.1'
```

Expected: `package.json` contains both packages in `dependencies`, `package-lock.json` is updated, and npm reports no engine incompatibility on Node.js 24.

- [ ] **Step 2: Write failing configuration hierarchy tests**

Create `__tests__/registryConfig.test.js` using `fs.mkdtempSync`, `fs.writeFileSync`, and isolated `HOME`, `npm_config_userconfig`, and `npm_config_globalconfig` paths. Include these assertions:

```js
const config = await RegistryConfig.load({
  argv: ['--registry=https://cli.example.test/npm/'],
  env: {
    ...process.env,
    HOME: home,
    npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig
  },
  cwd: project
})

expect(config.registryFor('left-pad')).toBe('https://cli.example.test/npm/')
expect(config.registryFor('@company/tool')).toBe(
  'https://scope.example.test/artifactory/api/npm/company/'
)
expect(config.requestOptions['//scope.example.test/artifactory/api/npm/company/:_authToken'])
  .toBe('scope-token')
expect(config.describeRegistry('@company/tool')).not.toContain('scope-token')
```

Write project, user, and global files with different `registry` values, a scoped registry, and a registry-scoped token. Add separate tests proving environment overrides project and project overrides user/global. Add:

```js
expect(config.requestOptions[
  '//basic.example.test/npm/:username'
]).toBe('ci-user')
expect(config.requestOptions[
  '//basic.example.test/npm/:_password'
]).toBe(Buffer.from('ci-password').toString('base64'))
expect(() => RegistryConfig.defaults().requestOptions.registry).not.toThrow()
expect(RegistryConfig.defaults().registryFor('left-pad')).toBe(
  'https://registry.npmjs.org/'
)
```

- [ ] **Step 3: Run the new test and verify it fails**

Run:

```bash
npm test -- --runInBand __tests__/registryConfig.test.js
```

Expected: FAIL because `lib/helpers/registryConfig.js` does not exist.

- [ ] **Step 4: Implement RegistryConfig**

Create `lib/helpers/registryConfig.js`:

```js
'use strict'

const path = require('node:path')
const Config = require('@npmcli/config')
const npmFetch = require('npm-registry-fetch')
const {
  definitions,
  flatten,
  nerfDarts,
  shorthands
} = require('@npmcli/config/lib/definitions')
const { RegistryError, sanitizeRegistryUrl } = require('./registryErrors')

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

function normalizeRegistry(value) {
  const url = new URL(value || DEFAULT_REGISTRY)
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/'
  }
  return url.toString()
}

class RegistryConfig {
  constructor(requestOptions) {
    this.requestOptions = Object.freeze({
      ...requestOptions,
      registry: normalizeRegistry(requestOptions.registry)
    })
  }

  static defaults() {
    return new RegistryConfig({ registry: DEFAULT_REGISTRY })
  }

  static async load({
    argv = [],
    env = process.env,
    cwd = process.cwd()
  } = {}) {
    try {
      const config = new Config({
        npmPath: path.resolve(__dirname, '../..'),
        definitions,
        shorthands,
        flatten,
        nerfDarts,
        argv: ['node', 'npq', ...argv],
        env,
        cwd,
        warn: false
      })
      await config.load()
      config.validate()
      return new RegistryConfig(config.flat)
    } catch (error) {
      const code =
        error.code === 'ERR_INVALID_AUTH'
          ? 'EREGISTRYCONFIGAUTH'
          : 'EREGISTRYCONFIG'
      const message =
        error.code === 'ERR_INVALID_AUTH'
          ? 'Invalid npm registry authentication configuration'
          : `Unable to load npm registry configuration: ${error.code || error.name}`
      throw new RegistryError(message, { code, cause: error })
    }
  }

  registryFor(packageSpec) {
    return normalizeRegistry(
      npmFetch.pickRegistry(packageSpec, this.requestOptions)
    )
  }

  describeRegistry(packageSpec) {
    return sanitizeRegistryUrl(this.registryFor(packageSpec))
  }
}

module.exports = RegistryConfig
```

- [ ] **Step 5: Write failing CLI parsing tests**

In `__tests__/cli.parser.complete.test.js`, make the mocked parser return:

```js
values: {
  registry: 'https://artifactory.example.test/api/npm/npm/',
  userconfig: '/tmp/user.npmrc',
  globalconfig: '/tmp/global.npmrc'
}
```

Assert both `parseArgsFull()` and `parseArgsMinimal()` return:

```js
registryConfigArgs: [
  '--registry=https://artifactory.example.test/api/npm/npm/',
  '--userconfig=/tmp/user.npmrc',
  '--globalconfig=/tmp/global.npmrc'
]
```

Update every exact parser-result assertion to include `registryConfigArgs: []` when none are supplied.

- [ ] **Step 6: Extend the CLI parser without consuming package-manager forwarding**

Add these options to both parser option maps:

```js
registry: { type: 'string' },
userconfig: { type: 'string' },
globalconfig: { type: 'string' }
```

Add:

```js
static registryConfigArgs(values = {}) {
  return ['registry', 'userconfig', 'globalconfig'].flatMap((key) =>
    values[key] ? [`--${key}=${values[key]}`] : []
  )
}
```

Return `registryConfigArgs: this.registryConfigArgs(values)` from both parser methods. In `parseArgsMinimal()`, destructure `values` as well as `positionals`. Add the three standard flags to the help output. Do not remove them from `process.argv`; `packageManager.spawnPackageManager()` must continue forwarding them.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test -- --runInBand __tests__/registryConfig.test.js __tests__/cli.parser.complete.test.js
npm run lint
```

Expected: PASS.

Commit:

```bash
git add package.json package-lock.json lib/helpers/registryConfig.js lib/cli.js __tests__/registryConfig.test.js __tests__/cli.parser.complete.test.js
git commit -m "feat: load npm-compatible registry configuration"
```

---

### Task 3: Centralize registry HTTP behavior

**Files:**
- Create: `lib/helpers/registryClient.js`
- Test: `__tests__/registryClient.test.js`

**Interfaces:**
- Consumes: `RegistryConfig.requestOptions`, `RegistryConfig.registryFor(spec)`, `NotEvaluated`, and `RegistryError`.
- Produces: `RegistryClient.public(): RegistryClient`.
- Produces: `registryFor(packageSpec): string`.
- Produces: `getPackageInfo(packageName): Promise<object | {error: 'Not found'}>`.
- Produces: `getManifest(packageSpec, packument): Promise<object>`.
- Produces: `getRegistryKeys(packageSpec): Promise<Array<object>>`.
- Produces: `getAttestations(packageSpec, manifest): Promise<Array<object>>`.
- Produces: `getDownloadInfo(packageName): Promise<number>`.

- [ ] **Step 1: Write failing routing and failure-classification tests**

Create an injected fetcher:

```js
const fetcher = {
  json: jest.fn()
}
const config = new RegistryConfig({
  registry: 'https://registry.npmjs.org/',
  '@company:registry':
    'https://artifactory.example.test/api/npm/company/'
})
const client = new RegistryClient(config, { fetcher })
```

Cover:

```js
await client.getPackageInfo('@company/tool')
expect(fetcher.json).toHaveBeenCalledWith('@company%2ftool', expect.objectContaining({
  spec: '@company/tool',
  registry: 'https://registry.npmjs.org/',
  '@company:registry': 'https://artifactory.example.test/api/npm/company/'
}))
```

Also test:

- package metadata `404` returns `{ error: 'Not found' }`;
- metadata `401`, `403`, `500`, and rejected network calls throw `RegistryError`;
- optional `404`, `405`, and `501` throw `NotEvaluated`;
- empty signing-key arrays are cached as unavailable;
- malformed successful JSON throws `RegistryError`;
- a custom registry download check throws `NotEvaluated` without calling `fetcher.json`;
- a public registry download check calls `https://api.npmjs.org/downloads/point/last-month/<escaped-name>`;
- registry keys are cached separately for two scopes;
- an advertised `https://registry.npmjs.org/-/npm/v1/attestations/pkg@1.0.0` URL is requested as the relative path `-/npm/v1/attestations/pkg@1.0.0` with the Artifactory package spec.

- [ ] **Step 2: Run the client test and verify it fails**

Run:

```bash
npm test -- --runInBand __tests__/registryClient.test.js
```

Expected: FAIL because `RegistryClient` does not exist.

- [ ] **Step 3: Implement RegistryClient**

Create `lib/helpers/registryClient.js` with this complete public shape and helpers:

```js
'use strict'

const npa = require('npm-package-arg')
const npmFetch = require('npm-registry-fetch')
const NotEvaluated = require('./notEvaluated')
const RegistryConfig = require('./registryConfig')
const { RegistryError } = require('./registryErrors')

const PUBLIC_REGISTRY = 'https://registry.npmjs.org/'
const OPTIONAL_STATUS = new Set([404, 405, 501])
const CAPABILITY = Object.freeze({
  SIGNING_KEYS: 'signing-keys',
  ATTESTATIONS: 'attestations',
  DOWNLOAD_COUNTS: 'download-counts'
})
const CAPABILITY_MESSAGE = Object.freeze({
  [CAPABILITY.SIGNING_KEYS]:
    'configured registry does not expose signing keys',
  [CAPABILITY.ATTESTATIONS]:
    'configured registry does not expose attestations',
  [CAPABILITY.DOWNLOAD_COUNTS]:
    'download counts are available only for the public npm registry'
})

class RegistryClient {
  constructor(registryConfig, { fetcher = npmFetch } = {}) {
    this.registryConfig = registryConfig
    this.fetcher = fetcher
    this.keyCache = new Map()
    this.capabilityCache = new Map()
  }

  static public() {
    return new RegistryClient(RegistryConfig.defaults())
  }

  registryFor(packageSpec) {
    return this.registryConfig.registryFor(packageSpec)
  }

  requestOptions(packageSpec) {
    return {
      ...this.registryConfig.requestOptions,
      spec: packageSpec,
      headers: {
        accept: 'application/json',
        'user-agent': 'npq-npm-registry-client'
      }
    }
  }

  async requestJson(
    requestPath,
    packageSpec,
    { capability = null, notFoundAsData = false } = {}
  ) {
    const registry = this.registryFor(packageSpec)
    try {
      return await this.fetcher.json(
        requestPath,
        this.requestOptions(packageSpec)
      )
    } catch (error) {
      const statusCode = error.statusCode || error.status || null
      if (notFoundAsData && statusCode === 404) {
        return { error: 'Not found' }
      }
      if (capability && OPTIONAL_STATUS.has(statusCode)) {
        this.capabilityCache.set(`${registry}|${capability}`, false)
        throw new NotEvaluated(CAPABILITY_MESSAGE[capability], { capability })
      }
      const code =
        statusCode === 401 || statusCode === 403
          ? 'EREGISTRYAUTH'
          : statusCode
            ? 'EREGISTRYHTTP'
            : 'EREGISTRYNETWORK'
      throw new RegistryError(
        statusCode === 401 || statusCode === 403
          ? 'Registry authentication or authorization failed'
          : statusCode
            ? `Registry request failed with HTTP ${statusCode}`
            : 'Registry network request failed',
        { registry, code, statusCode, cause: error }
      )
    }
  }

  async getPackageInfo(packageName) {
    const spec = npa(packageName)
    const data = await this.requestJson(spec.escapedName, packageName, {
      notFoundAsData: true
    })
    if (data && data.error === 'Not found') {
      return data
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new RegistryError('Registry package metadata is malformed', {
        registry: this.registryFor(packageName),
        code: 'EREGISTRYPROTOCOL'
      })
    }
    return data
  }

  async getManifest(packageSpec, packument = null) {
    const spec = npa(packageSpec)
    const data = packument || (await this.getPackageInfo(spec.name))
    let version = spec.fetchSpec
    if (!version || version === '*' || version === 'latest') {
      version = data['dist-tags'] && data['dist-tags'].latest
    }
    if (!data.versions || !data.versions[version]) {
      throw new Error(`Version ${version} not found for package ${spec.name}`)
    }
    return {
      ...data.versions[version],
      ...(data.time && data.time[version] ? { _time: data.time[version] } : {})
    }
  }

  unavailable(capability) {
    throw new NotEvaluated(CAPABILITY_MESSAGE[capability], { capability })
  }

  async getRegistryKeys(packageSpec) {
    const registry = this.registryFor(packageSpec)
    const cacheKey = `${registry}|${CAPABILITY.SIGNING_KEYS}`
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)
    }
    if (this.capabilityCache.get(cacheKey) === false) {
      return this.unavailable(CAPABILITY.SIGNING_KEYS)
    }
    const response = await this.requestJson('-/npm/v1/keys', packageSpec, {
      capability: CAPABILITY.SIGNING_KEYS
    })
    if (!response || !Array.isArray(response.keys)) {
      throw new RegistryError('Registry signing-key response is malformed', {
        registry,
        code: 'EREGISTRYPROTOCOL'
      })
    }
    if (response.keys.length === 0) {
      this.capabilityCache.set(cacheKey, false)
      return this.unavailable(CAPABILITY.SIGNING_KEYS)
    }
    const keys = response.keys.map((key) => ({
      ...key,
      pemkey: `-----BEGIN PUBLIC KEY-----\n${key.key}\n-----END PUBLIC KEY-----`
    }))
    this.keyCache.set(cacheKey, keys)
    return keys
  }

  async getAttestations(packageSpec, manifest) {
    const registry = this.registryFor(packageSpec)
    const cacheKey = `${registry}|${CAPABILITY.ATTESTATIONS}`
    if (this.capabilityCache.get(cacheKey) === false) {
      return this.unavailable(CAPABILITY.ATTESTATIONS)
    }
    let requestPath
    try {
      requestPath = new URL(manifest.dist.attestations.url).pathname.replace(
        /^\/+/, ''
      )
    } catch (error) {
      throw new RegistryError('Package attestation URL is malformed', {
        registry,
        code: 'EREGISTRYPROTOCOL',
        cause: error
      })
    }
    const response = await this.requestJson(requestPath, packageSpec, {
      capability: CAPABILITY.ATTESTATIONS
    })
    if (!response || !Array.isArray(response.attestations)) {
      throw new RegistryError('Registry attestation response is malformed', {
        registry,
        code: 'EREGISTRYPROTOCOL'
      })
    }
    if (response.attestations.length === 0) {
      this.capabilityCache.set(cacheKey, false)
      return this.unavailable(CAPABILITY.ATTESTATIONS)
    }
    return response.attestations
  }

  async getDownloadInfo(packageName) {
    if (this.registryFor(packageName) !== PUBLIC_REGISTRY) {
      return this.unavailable(CAPABILITY.DOWNLOAD_COUNTS)
    }
    const escapedName = npa(packageName).escapedName
    const response = await this.requestJson(
      `https://api.npmjs.org/downloads/point/last-month/${escapedName}`,
      packageName
    )
    if (!response || typeof response.downloads !== 'number') {
      throw new RegistryError('Registry download response is malformed', {
        registry: PUBLIC_REGISTRY,
        code: 'EREGISTRYPROTOCOL'
      })
    }
    return response.downloads
  }
}

module.exports = RegistryClient
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- --runInBand __tests__/registryClient.test.js
npm run lint
```

Expected: PASS with one HTTP call per cached registry capability and no npmjs call for custom-registry packages.

Commit:

```bash
git add lib/helpers/registryClient.js __tests__/registryClient.test.js
git commit -m "feat: centralize authenticated registry requests"
```

---

### Task 4: Inject the registry context through metadata and CLI startup

**Files:**
- Modify: `lib/helpers/packageRepoUtils.js:1-43`
- Modify: `lib/marshall.js:1-55`
- Modify: `lib/marshalls/baseMarshall.js:8-14`
- Modify: `lib/marshalls/index.js:20-38,133-145`
- Modify: `bin/npq.js:8-58`
- Modify: `bin/npq-hero.js:8-38`
- Test: `__tests__/packageRepoUtils.test.js`
- Test: `__tests__/cli.test.js`
- Test: `__tests__/exitCode.test.js`

**Interfaces:**
- Consumes: `RegistryConfig.load()`, `new RegistryClient(config)`.
- Produces: `new Marshall({ registryClient, packageRepoUtils? })`.
- Produces: every marshall receives `options.registryClient`.
- Produces: metadata cache key `<normalized-registry>|<package-name>`.

- [ ] **Step 1: Rewrite PackageRepoUtils tests around an injected client**

Replace global-fetch expectations with:

```js
const registryClient = {
  registryFor: jest.fn((pkg) =>
    pkg.startsWith('@company/')
      ? 'https://artifactory.example.test/api/npm/company/'
      : 'https://registry.npmjs.org/'
  ),
  getPackageInfo: jest.fn().mockResolvedValue(registryPackageOk),
  getDownloadInfo: jest.fn().mockResolvedValue(1950)
}
const packageRepoUtils = new PackageRepoUtils({ registryClient })
```

Assert two identical requests use one client call, while the same package name after changing its selected registry uses a separate cache entry. Preserve all existing semver, README, license, and GitHub repository tests.

- [ ] **Step 2: Run PackageRepoUtils tests and verify they fail**

Run:

```bash
npm test -- --runInBand __tests__/packageRepoUtils.test.js
```

Expected: FAIL because PackageRepoUtils still calls global `fetch`.

- [ ] **Step 3: Delegate PackageRepoUtils network access**

Replace its constructor and registry methods with:

```js
constructor({ registryClient = RegistryClient.public() } = {}) {
  this.registryClient = registryClient
  this.pkgInfoCache = {}
}

getPackageInfo(pkg) {
  const cacheKey = `${this.registryClient.registryFor(pkg)}|${pkg}`
  if (this.pkgInfoCache[cacheKey]) {
    return Promise.resolve(this.pkgInfoCache[cacheKey])
  }
  return this.registryClient.getPackageInfo(pkg).then((data) => {
    this.pkgInfoCache[cacheKey] = data
    return data
  })
}

getDownloadInfo(pkg) {
  return this.registryClient.getDownloadInfo(pkg)
}
```

Import `RegistryClient` at the top. Remove `NPM_REGISTRY`, `NPM_REGISTRY_API`, `registryUrl`, `registryApiUrl`, and direct fetches. Leave non-network helpers unchanged.

- [ ] **Step 4: Pass RegistryClient through Marshall and marshall construction**

In `lib/marshall.js`:

```js
this.registryClient = options.registryClient || RegistryClient.public()
this.packageRepoUtils =
  options.packageRepoUtils ||
  new PackageRepoUtils({ registryClient: this.registryClient })
```

Include `registryClient` in `createPackageAuditFunction()` config. In `BaseMarshall`, assign `this.registryClient = options.registryClient`. In `Marshalls.buildMarshallTasks()`, include both `packageRepoUtils` and `registryClient`, and pass the client from `tasks()`.

- [ ] **Step 5: Write CLI startup tests before changing entry points**

Mock:

```js
jest.mock('../lib/helpers/registryConfig', () => ({
  load: jest.fn().mockResolvedValue({ requestOptions: {} })
}))
jest.mock('../lib/helpers/registryClient', () =>
  jest.fn().mockImplementation(() => ({ registryFor: jest.fn() }))
)
```

For both binaries, assert `RegistryConfig.load` receives the parser's `registryConfigArgs` and `Marshall` receives the constructed `registryClient`. Add a rejected-load case and assert `CliParser.exit` receives the sanitized registry error and no package-manager process is invoked.

- [ ] **Step 6: Load configuration before constructing Marshall**

In each binary, import `RegistryConfig` and `RegistryClient`. Add the first asynchronous stage:

```js
RegistryConfig.load({ argv: cliArgs.registryConfigArgs })
  .then((registryConfig) => {
    const registryClient = new RegistryClient(registryConfig)
    const marshall = new Marshall({
      pkgs: cliArgs.packages,
      registryClient,
      progressManager: spinner,
      promiseThrottleHelper
    })
    return marshall.process()
  })
```

For `bin/npq.js`, retain the existing project-package discovery before constructing `Marshall`; carry `registryClient` through that promise stage. Keep the existing final catch so configuration failures go through `CliParser.exit`.

- [ ] **Step 7: Run focused tests and commit**

Run:

```bash
npm test -- --runInBand __tests__/packageRepoUtils.test.js __tests__/cli.test.js __tests__/exitCode.test.js __tests__/marshalls.tasks.test.js
```

Expected: PASS.

Commit:

```bash
git add lib/helpers/packageRepoUtils.js lib/marshall.js lib/marshalls/baseMarshall.js lib/marshalls/index.js bin/npq.js bin/npq-hero.js __tests__/packageRepoUtils.test.js __tests__/cli.test.js __tests__/exitCode.test.js __tests__/marshalls.tasks.test.js
git commit -m "feat: inject registry configuration into package audits"
```

---

### Task 5: Migrate signature and provenance requests

**Files:**
- Modify: `lib/helpers/npmRegistry.js:1-288`
- Modify: `lib/marshalls/signatures.marshall.js:1-106`
- Modify: `lib/marshalls/provenance.marshall.js:1-207`
- Test: `__tests__/npmRegistry.test.js`
- Test: `__tests__/marshalls.signatures.test.js`
- Test: `__tests__/marshalls.provenance.test.js`

**Interfaces:**
- Consumes: `registryClient.getManifest(spec, packument)`, `getRegistryKeys(spec)`, and `getAttestations(spec, manifest)`.
- Produces: `NpmRegistry.verifyAttestations(manifest, registryKeys, attestations)`.
- Preserves: current verification error codes and package-level severity rules.

- [ ] **Step 1: Replace network mocks with injected-client expectations**

In signature tests, construct:

```js
const registryClient = {
  getManifest: jest.fn().mockResolvedValue(mockManifest),
  getRegistryKeys: jest.fn().mockResolvedValue(mockRegistryKeys)
}
const marshall = new SignaturesMarshall({
  packageRepoUtils,
  registryClient
})
```

Assert both methods receive the resolved package spec and the already-fetched packument. Add cases where each method rejects `NotEvaluated` and `RegistryError`; assert those exact instances are rethrown instead of wrapped in `Warning`.

In provenance tests, also mock:

```js
getAttestations: jest.fn().mockResolvedValue(mockAttestations)
```

Assert missing `manifest.dist.attestations` keeps the current package warning/regression path without calling `getAttestations`.

- [ ] **Step 2: Run marshall tests and verify they fail**

Run:

```bash
npm test -- --runInBand __tests__/marshalls.signatures.test.js __tests__/marshalls.provenance.test.js
```

Expected: FAIL because both marshalls still construct hard-coded npmjs clients.

- [ ] **Step 3: Make NpmRegistry verification-only**

Remove `getManifest()`, the constructor registry URL, `npm-package-arg`, and the attestation fetch from `lib/helpers/npmRegistry.js`. Change the attestation signature to:

```js
async verifyAttestations(manifest, registryKeys, attestations) {
  if (!manifest.dist || !manifest.dist.attestations) {
    throw new Error('Package has no attestations to verify')
  }
  if (!Array.isArray(attestations)) {
    throw new Error('Package attestations response is invalid')
  }

  const bundles = attestations.map(({ predicateType, bundle }) => {
    const statement = JSON.parse(
      Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString('utf8')
    )
    const keyid = bundle.dsseEnvelope.signatures[0].keyid
    const signature = bundle.dsseEnvelope.signatures[0].sig
    return { predicateType, bundle, statement, keyid, signature }
  })
```

Keep the remaining subject, integrity, key-expiry, and Sigstore verification logic unchanged. Update `__tests__/npmRegistry.test.js` to pass `mockAttestations` directly and delete manifest/attestation network tests now covered by `registryClient.test.js`.

- [ ] **Step 4: Migrate the signature marshall**

Use one verifier instance and the injected client. Check the manifest for package-level signature absence before requesting the optional key service:

```js
const verifier = new NpmRegistry()
const manifest = await this.registryClient.getManifest(
  `${pkg.packageName}@${resolvedVersion}`,
  packageInfo
)
if (!manifest.dist || !manifest.dist.signatures) {
  return verifier.verifySignatures(manifest, [])
}
const keys = await this.registryClient.getRegistryKeys(pkg.packageName)
return verifier.verifySignatures(manifest, keys)
```

Delete `fetchRegistryKeys()`, its module cache, and all hard-coded URLs. At the start of the catch block:

```js
if (error instanceof NotEvaluated || error instanceof RegistryError) {
  throw error
}
```

Retain expired-key and normal package-warning behavior below it.

- [ ] **Step 5: Migrate the provenance marshall**

After resolving `validationMetadata`, inspect the manifest before requesting optional services. This preserves the existing missing-provenance and provenance-regression behavior even when the registry has no signing-key endpoint:

```js
const manifest = await this.registryClient.getManifest(
  `${validationMetadata.name}@${validationMetadata.version}`,
  validationMetadata.packageInfo
)
if (!manifest.dist || !manifest.dist.attestations) {
  return verifier.verifyAttestations(manifest, [], null)
}
const [keys, attestations] = await Promise.all([
  this.registryClient.getRegistryKeys(validationMetadata.name),
  this.registryClient.getAttestations(validationMetadata.name, manifest)
])
return verifier.verifyAttestations(manifest, keys, attestations)
```

Delete `fetchRegistryKeys()` and hard-coded URLs. At the start of the catch block, rethrow `NotEvaluated` and `RegistryError` before provenance-regression classification. Preserve malformed-checkpoint suppression and all existing package-level warnings/errors.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- --runInBand __tests__/npmRegistry.test.js __tests__/marshalls.signatures.test.js __tests__/marshalls.provenance.test.js
npm run lint
```

Expected: PASS, and:

```bash
rg -n "registry\.npmjs\.org" lib/marshalls/signatures.marshall.js lib/marshalls/provenance.marshall.js lib/helpers/npmRegistry.js
```

Expected: no matches.

Commit:

```bash
git add lib/helpers/npmRegistry.js lib/marshalls/signatures.marshall.js lib/marshalls/provenance.marshall.js __tests__/npmRegistry.test.js __tests__/marshalls.signatures.test.js __tests__/marshalls.provenance.test.js
git commit -m "feat: verify signatures and provenance through configured registries"
```

---

### Task 6: Expose skipped checks without changing install decisions

**Files:**
- Modify: `bin/npq.js:58-130`
- Modify: `bin/npq-hero.js:39-102`
- Test: `__tests__/cli.test.js`
- Test: `__tests__/exitCode.test.js`
- Test: `__tests__/marshalls.downloads.test.js`
- Test: `__tests__/packageManager.test.js`

**Interfaces:**
- Consumes: `reportResults().countNotEvaluated`.
- Produces: visible output when skipped checks are the only results.
- Preserves: prompt/install decisions use only `countErrors` and `countWarnings`.

- [ ] **Step 1: Add failing CLI decision tests**

Mock `reportResults` with:

```js
{
  countErrors: 0,
  countWarnings: 0,
  countNotEvaluated: 2,
  resultsForPrettyPrint: 'skipped-rich',
  resultsForPlainTextPrint: 'skipped-plain',
  summaryForPrettyPrint: 'summary-rich',
  summaryForPlainTextPrint: 'summary-plain',
  useRichFormatting: false
}
```

For both binaries assert:

- skipped output is printed;
- neither prompt nor auto-continue runs;
- an explicit install still invokes the package manager;
- audit-only mode exits successfully;
- a mixed skipped-plus-warning result still follows warning behavior.

Add a download marshall case whose injected helper rejects `NotEvaluated`; through `BaseMarshall.run()`, assert the result contains one skipped entry and no warning/error.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- --runInBand __tests__/cli.test.js __tests__/exitCode.test.js __tests__/marshalls.downloads.test.js
```

Expected: FAIL because the binaries print only when warnings or errors exist.

- [ ] **Step 3: Separate reportability from findings**

In both binaries replace the current `isErrors` block with:

```js
const {
  countErrors,
  countWarnings,
  countNotEvaluated = 0,
  useRichFormatting
} = results
const hasFindings = countErrors > 0 || countWarnings > 0
const hasReportableResults = hasFindings || countNotEvaluated > 0

if (hasReportableResults) {
  console.log()
  console.log(
    hasFindings ? 'Packages with issues found:' : 'Package checks not evaluated:'
  )
  if (useRichFormatting) {
    console.log(results.resultsForPrettyPrint)
    console.log(results.summaryForPrettyPrint)
  } else {
    console.log(results.resultsForPlainTextPrint)
    console.log(results.summaryForPlainTextPrint)
  }
}

return {
  anyIssues: hasFindings,
  countErrors,
  countWarnings,
  countNotEvaluated
}
```

Leave the audit-only exit calculation and prompt branches based only on errors and warnings.

- [ ] **Step 4: Verify registry flags remain forwarded**

Add to `__tests__/packageManager.test.js`:

```js
process.argv = [
  'node',
  'npq',
  'install',
  '@company/tool',
  '--registry=https://artifactory.example.test/api/npm/npm/'
]
await packageManager.process('pnpm')
expect(childProcess.spawn).toHaveBeenCalledWith(
  'pnpm install @company/tool --registry=https://artifactory.example.test/api/npm/npm/',
  expect.objectContaining({ stdio: 'inherit', shell: true })
)
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- --runInBand __tests__/cli.test.js __tests__/exitCode.test.js __tests__/marshalls.downloads.test.js __tests__/packageManager.test.js
```

Expected: PASS.

Commit:

```bash
git add bin/npq.js bin/npq-hero.js __tests__/cli.test.js __tests__/exitCode.test.js __tests__/marshalls.downloads.test.js __tests__/packageManager.test.js
git commit -m "feat: report registry checks that were not evaluated"
```

---

### Task 7: Prove authenticated Artifactory behavior end to end

**Files:**
- Create: `__tests__/customRegistry.integration.test.js`
- Modify: `__tests__/registryConfig.test.js`
- Modify: `__tests__/registryClient.test.js`
- Modify: `__tests__/marshalls.tasks.test.js`

**Interfaces:**
- Exercises: `RegistryConfig -> RegistryClient -> PackageRepoUtils -> Marshall -> marshall result`.
- Proves: per-scope routing, auth/path isolation, CA/proxy flattening, no npmjs fallback, fatal propagation, and redaction.

- [ ] **Step 1: Add real config-file integration fixtures**

In `__tests__/customRegistry.integration.test.js`, create a temporary project with:

```ini
registry=https://artifactory.example.test/artifactory/api/npm/npm/
@company:registry=https://artifactory.example.test/artifactory/api/npm/company/
//artifactory.example.test/artifactory/api/npm/:_authToken=${ARTIFACTORY_TOKEN}
strict-ssl=true
```

Load it with:

```js
const config = await RegistryConfig.load({
  argv: [],
  env: {
    ...process.env,
    HOME: home,
    ARTIFACTORY_TOKEN: 'integration-secret',
    npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig
  },
  cwd: project
})
```

Inject a transport whose `json` implementation records URL/options and returns Artifactory-style packuments, keys, and attestations. Construct `RegistryClient`, `PackageRepoUtils`, and `Marshall` with that client.

Limit the integration run to the registry-dependent marshalls and bypass cryptographic fixture complexity:

```js
jest.spyOn(Marshalls, 'collectMarshalls').mockResolvedValue([
  path.join(process.cwd(), 'lib/marshalls/signatures.marshall.js'),
  path.join(process.cwd(), 'lib/marshalls/provenance.marshall.js'),
  path.join(process.cwd(), 'lib/marshalls/downloads.marshall.js')
])
jest
  .spyOn(NpmRegistry.prototype, 'verifySignatures')
  .mockResolvedValue({ _signatures: [{}] })
jest
  .spyOn(NpmRegistry.prototype, 'verifyAttestations')
  .mockResolvedValue({ _attestations: {} })
```

- [ ] **Step 2: Assert the full success path and privacy boundary**

Audit one unscoped package and one `@company` package. Assert:

```js
expect(calls.every(({ url }) => !String(url).includes('registry.npmjs.org'))).toBe(true)
expect(calls.every(({ url }) => !String(url).includes('api.npmjs.org'))).toBe(true)
expect(calls.some(({ options }) =>
  options['//artifactory.example.test/artifactory/api/npm/:_authToken'] ===
  'integration-secret'
)).toBe(true)
```

Assert the scoped packument uses the company registry, attestation requests use relative paths under the selected Artifactory base path, and no report/error string contains `integration-secret`.

- [ ] **Step 3: Assert optional and fatal paths**

Add transport variants:

- key endpoint `404`: signatures and provenance become `notEvaluated`, with one capability probe per registry;
- download check on Artifactory: `notEvaluated` with zero public API calls;
- packument `401`: `Marshall.process()` rejects `RegistryError` with code `EREGISTRYAUTH`;
- key endpoint `500`: the audit rejects rather than skipping;
- malformed key or attestation JSON: the audit rejects `EREGISTRYPROTOCOL`;
- metadata `404`: existing `not_found` marshall result remains.

- [ ] **Step 4: Cover CA, client certificate, proxy, and redaction**

In `registryConfig.test.js`, create temporary CA, cert, and key PEM files and registry-scoped `certfile`/`keyfile` entries. Set `https-proxy` and `strict-ssl`. Assert `config.requestOptions.ca` contains the loaded CA text, `httpsProxy` and `strictSSL` contain the flattened values, and the registry-scoped `certfile` and `keyfile` entries contain their file paths. `npm-registry-fetch` reads the client certificate and key from those scoped paths only when it authenticates to the matching registry.

In `registryClient.test.js`, make the transport reject with an error message containing a token and a credential-bearing URL. Assert the public `RegistryError.message`, `registry`, and JSON serialization contain neither secret nor URL credentials. Keep raw cause text only in the non-rendered `cause` field and never concatenate it into the public error message.

- [ ] **Step 5: Run integration and full regression tests**

Run:

```bash
npm test -- --runInBand __tests__/customRegistry.integration.test.js __tests__/registryConfig.test.js __tests__/registryClient.test.js __tests__/marshalls.tasks.test.js
npm test -- --runInBand
npm run lint
```

Expected: all tests and lint pass.

- [ ] **Step 6: Commit**

```bash
git add __tests__/customRegistry.integration.test.js __tests__/registryConfig.test.js __tests__/registryClient.test.js __tests__/marshalls.tasks.test.js lib/helpers/registryErrors.js
git commit -m "test: cover authenticated custom registry audits"
```

---

### Task 8: Document and release custom-registry support

**Files:**
- Create: `docs/feature/custom-registry.md`
- Create: `.changeset/bright-tools-audit.md`
- Modify: `README.md:73-125,127-176,260-263`
- Modify: `docs/README.md`

**Interfaces:**
- Documents: standard config, precedence, scoped auth, CA setup, skipped capabilities, failure behavior, and no-fallback guarantee.
- Produces: a minor release note for package `npq`.

- [ ] **Step 1: Write the user guide**

Create `docs/feature/custom-registry.md` with these tested examples:

```ini
registry=https://artifactory.example.com/artifactory/api/npm/npm-virtual/
//artifactory.example.com/artifactory/api/npm/npm-virtual/:_authToken=${ARTIFACTORY_TOKEN}
```

```ini
@company:registry=https://artifactory.example.com/artifactory/api/npm/company/
//artifactory.example.com/artifactory/api/npm/company/:_authToken=${ARTIFACTORY_TOKEN}
```

```ini
cafile=/absolute/path/to/company-ca.pem
strict-ssl=true
```

State the exact precedence, explain that `--registry` is shared with the installer, list signatures/provenance/downloads as checks that may report `not evaluated`, and state that npq never falls back to npmjs for a package assigned to a custom registry. Warn users to scope auth keys to the registry host/path and never commit tokens.

- [ ] **Step 2: Update README and documentation index**

Add a “Custom registries” subsection under Usage with:

```sh
npq install @company/tool --registry=https://artifactory.example.com/artifactory/api/npm/npm-virtual/
```

Link to `docs/feature/custom-registry.md`. Update the marshall documentation for signatures, provenance, and downloads to mention `not evaluated` behavior. Add the feature guide and this plan under the appropriate sections of `docs/README.md`.

- [ ] **Step 3: Add the Changeset**

Create `.changeset/bright-tools-audit.md`:

```markdown
---
'npq': minor
---

Add authenticated default and scoped custom-registry support using standard npm configuration, with explicit reporting when optional registry services cannot be evaluated.
```

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test -- --runInBand
npm run lint
git diff --check
rg -n "https?://registry\.npmjs\.org|https?://api\.npmjs\.org" lib
```

Expected:

- all tests pass;
- lint passes;
- `git diff --check` prints nothing;
- remaining npmjs constants exist only in `registryConfig.js` and `registryClient.js` as explicit public defaults/services, not in marshalls or metadata helpers.

Run a build smoke test:

```bash
npm run build
```

Expected: exit code 0 and no generated build artifact is staged.

- [ ] **Step 5: Review scope and commit**

Run:

```bash
git status --short
git diff --stat
```

Expected: only custom-registry implementation, tests, docs, dependency lockfile, and Changeset files are present.

Commit:

```bash
git add README.md docs/README.md docs/feature/custom-registry.md .changeset/bright-tools-audit.md
git commit -m "docs: explain custom registry configuration"
```

---

## Completion Checklist

- [ ] Default npmjs behavior passes all existing tests.
- [ ] Project, user, global, environment, and CLI precedence are covered.
- [ ] Default and scoped Artifactory registry routing are covered.
- [ ] Token, basic auth, proxy, CA, client certificate, and strict-TLS propagation are covered.
- [ ] Metadata, manifests, keys, and attestations use the selected registry context.
- [ ] Custom-registry packages trigger no npmjs registry/download requests.
- [ ] Optional capability absence is visible and non-failing.
- [ ] Auth, transport, server, and malformed-response failures abort with redacted errors.
- [ ] Signature and provenance package-level severity behavior remains unchanged.
- [ ] Both `npq` and `npq-hero` are covered.
- [ ] README, feature docs, docs index, and Changeset are complete.
- [ ] `npm test -- --runInBand`, `npm run lint`, `npm run build`, and `git diff --check` pass.
