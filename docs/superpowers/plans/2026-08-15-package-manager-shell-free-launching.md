# Shell-Free Package Manager Launching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forward package-manager invocations as an executable plus argument array with `shell: false`, preserving literal CLI arguments and documented package-manager usage on Unix-like systems and Windows.

**Architecture:** Keep `packageManager.process()` as the public entry point. Refactor `spawnPackageManager()` to build the forwarded argument array without joining it into a command string, then use a small launch-spec helper: direct executable plus arguments on Unix-like systems, and `ComSpec`/`cmd.exe` plus launcher arguments on Windows. The low-runtime-version passthrough in `lib/helpers/cliSupportHandler.js` remains out of scope.

**Tech Stack:** Node.js `child_process.spawn`, CommonJS JavaScript, Jest 30, ESLint 9, Changesets.

## Global Constraints

- The child-process options must explicitly use `shell: false` and `stdio: 'inherit'`.
- Forwarded CLI values must remain separate array entries in their original order.
- `NPQ_PKG_MGR` and CLI package-manager options are bare executable values; embedded shell commands are no longer supported.
- Preserve the existing filtering of `--packageManager`, `--pkgMgr`, and `--dry-run` from forwarded arguments.
- Preserve child exit-code propagation.
- Do not change lockfile behavior or `lib/helpers/cliSupportHandler.js`.
- Do not include the pre-existing untracked `.env.development` file in any change.

---

### Task 1: Update package-manager regression tests first

**Files:**
- Modify: `__tests__/packageManager.test.js:42-150`
- Modify: `__tests__/env-var-integration.test.js:34-76`

**Interfaces:**
- Consumes: the existing `packageManager.process(packageManagerOption)` test entry point and mocked `childProcess.spawn`.
- Produces: failing expectations that define the executable/argument-array contract for the implementation task.

- [ ] **Step 1: Replace joined-command expectations with executable/array expectations**

Update the package-manager tests so every launch assertion expects this shape:

```js
expect(childProcess.spawn).toHaveBeenCalledWith(
  'npm',
  ['install', 'semver', 'express'],
  { stdio: 'inherit', shell: false }
)
```

Apply the same shape to the default-manager, yarn, pnpm, filter-order, custom-registry, and environment-integration cases, retaining each test's existing argument order and package-manager executable.

- [ ] **Step 2: Add a regression test for literal shell metacharacter arguments**

Add this test to `__tests__/packageManager.test.js`:

```js
test('passes shell metacharacters as literal arguments without enabling a shell', async () => {
  childProcess.spawn.mockImplementation(() => createMockChild(0))
  process.argv = ['node', 'npq', 'install', 'left;touch marker', 'quoted value']

  await packageManager.process('npm')

  expect(childProcess.spawn).toHaveBeenCalledWith(
    'npm',
    ['install', 'left;touch marker', 'quoted value'],
    { stdio: 'inherit', shell: false }
  )
})
```

- [ ] **Step 3: Add the Windows launch-spec expectation**

Add a focused test for the platform helper after the implementation exposes the helper used by `spawnPackageManager()`:

```js
test('uses the Windows command interpreter only as an explicit launcher', () => {
  expect(packageManager.getPackageManagerLaunchSpec('npm', ['install', 'express'], 'win32')).toEqual(
    {
      executable: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', 'install', 'express']
    }
  )
})
```

The test must assert the launch spec only; the actual `spawn()` options remain `shell: false` in the launch tests.

- [ ] **Step 4: Run the focused tests and verify they fail for the intended reason**

Run:

```sh
npm test -- --runInBand __tests__/packageManager.test.js __tests__/env-var-integration.test.js
```

Expected result: FAIL because the current implementation passes one joined command string, uses `shell: true`, and does not expose the Windows launch-spec helper. Do not change production code before observing this failure.

### Task 2: Implement shell-free package-manager launching

**Files:**
- Modify: `lib/packageManager.js:12-39`

**Interfaces:**
- Consumes: the validated bare executable string and the raw `process.argv.slice(2)` values.
- Produces: `getPackageManagerLaunchSpec(packageManagerOption, args, platform)` and a `child_process.spawn(executable, args, options)` invocation with shell disabled.

- [ ] **Step 1: Add the launch-spec helper**

Add this static method to `lib/packageManager.js`:

```js
static getPackageManagerLaunchSpec(packageManagerOption, args, platform = process.platform) {
  if (platform === 'win32') {
    return {
      executable: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', packageManagerOption, ...args]
    }
  }

  return {
    executable: packageManagerOption,
    args
  }
}
```

This keeps the Windows-compatible launcher decision isolated while retaining an argument array at the `spawn()` API boundary.

- [ ] **Step 2: Replace command reconstruction with the launch spec**

Replace the `cmd` string construction and shell-enabled spawn in `spawnPackageManager()` with:

```js
const args = process.argv.slice(2).filter((item) => {
  switch (item) {
    case '--packageManager':
    case '--pkgMgr':
    case '--dry-run':
      return false
    default:
      return true
  }
})

const { executable, args: launchArgs } = packageManager.getPackageManagerLaunchSpec(
  packageManagerOption,
  args
)

const child = childProcess.spawn(executable, launchArgs, {
  stdio: 'inherit',
  shell: false
})
```

Keep the existing `close` listener and Promise resolution unchanged so exit-code behavior is not bundled into this security fix.

- [ ] **Step 3: Run the focused tests and verify they pass**

Run:

```sh
npm test -- --runInBand __tests__/packageManager.test.js __tests__/env-var-integration.test.js
```

Expected result: PASS for all package-manager launch, argument-boundary, Windows-spec, filtering, and exit-code cases.

### Task 3: Add the release note and verify the complete change

**Files:**
- Create: `.changeset/safe-package-manager-launch.md`
- Modify: `lib/packageManager.js`
- Modify: `__tests__/packageManager.test.js`
- Modify: `__tests__/env-var-integration.test.js`

**Interfaces:**
- Consumes: the passing implementation and focused regression suite from Tasks 1-2.
- Produces: a patch changeset and a verified, reviewable security fix.

- [ ] **Step 1: Add the patch changeset**

Create `.changeset/safe-package-manager-launch.md` with:

```md
---
'npq': patch
---

Forward package-manager arguments without reconstructing a shell command or enabling shell execution.
```

- [ ] **Step 2: Run the full test suite**

Run:

```sh
npm test -- --runInBand
```

Expected result: all Jest suites pass with no new failures.

- [ ] **Step 3: Run linting**

Run:

```sh
npm run lint
```

Expected result: ESLint and lockfile lint complete successfully.

- [ ] **Step 4: Review the final diff and repository state**

Run:

```sh
git diff --check
git diff -- lib/packageManager.js __tests__/packageManager.test.js __tests__/env-var-integration.test.js .changeset/safe-package-manager-launch.md
git status --short
```

Confirm that the diff contains no `shell: true` or joined package-manager command in `lib/packageManager.js`, and that `.env.development` remains untracked and unchanged.

- [ ] **Step 5: Commit the implementation**

Stage only the implementation files and changeset, then commit with:

```sh
git add lib/packageManager.js __tests__/packageManager.test.js __tests__/env-var-integration.test.js .changeset/safe-package-manager-launch.md
git commit -m "fix: launch package managers without a shell"
```
