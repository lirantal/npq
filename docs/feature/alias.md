# Alias and Package Manager Passthrough

The alias feature allows npq to act as a transparent drop-in replacement for your package manager (`npm`, `yarn`, `pnpm`, etc.) by aliasing the package manager command to `npq-hero`. When used this way, npq intercepts install commands to run security checks, while passing all other commands (like `npm audit`, `npm test`, `npm run build`) straight through to the underlying package manager.

## Overview

npq provides two binaries:

- **`npq`**: A standalone CLI with its own flags (`--dry-run`, `--plain`, `--help`, etc.). Intended for explicit, on-demand use.
- **`npq-hero`**: A transparent wrapper designed to be aliased to your package manager. It has no CLI flags of its own to avoid conflicts with the package manager's flags.

When you alias `npm` to `npq-hero`, every `npm` command you run goes through npq first. For install commands, npq runs its security marshalls before handing off to the real package manager. For everything else, npq passes the command through untouched.

## How It Works

### Install commands

When `npq-hero` detects an install command (`install`, `i`, `add`, and common misspellings like `isntall`), it:

1. Extracts the package names from the arguments
2. Runs all enabled security marshalls against those packages
3. Reports any errors or warnings found
4. Prompts the user for confirmation (if errors) or auto-continues after a countdown (if only warnings)
5. Spawns the real package manager with the original arguments
6. Preserves the package manager's exit code as the process exit code

### Non-install commands (passthrough)

When the command is not an install (e.g. `npm audit`, `npm test`, `npm ls`, `yarn why`), npq-hero:

1. Detects that no packages need auditing (the package list is empty)
2. Runs the marshall pipeline with an empty package list (which completes instantly with no findings)
3. Falls through to spawn the real package manager with all original arguments
4. Preserves the package manager's exit code as the process exit code

This is what makes npq safe to use as a permanent alias -- non-install commands work exactly as they would without npq.

### Unsupported Node version fallback

If the Node.js version is below the minimum requirement (`>=20.13.0`), `npq-hero` prints a warning and falls back to a synchronous passthrough using `spawnSync`, which also correctly preserves exit codes. This ensures the alias never silently blocks package manager usage on older runtimes.

## Setting Up the Alias

### Automatic setup (postinstall)

When you install npq globally with `npm install -g npq`, the postinstall script offers to add aliases to your shell profile (`.bash_profile` for bash, `.zshrc` for zsh). The aliases added are:

```bash
alias npm="npq-hero"
alias yarn="NPQ_PKG_MGR=yarn npq-hero"
```

The postinstall script:
- Detects your shell from the `$SHELL` environment variable
- Checks if aliases are already present to avoid duplicates
- Only runs when installing via npm (not yarn, due to stdin limitations)
- Only runs with npm v6.x (npm v7+ restricts stdin during install)

On uninstall, the preuninstall script removes the alias block from your shell profile.

### Manual setup

Add one or more of these to your shell profile:

**npm:**

```bash
alias npm="npq-hero"
```

**yarn:**

```bash
alias yarn="NPQ_PKG_MGR=yarn npq-hero"
```

**pnpm:**

```bash
alias pnpm="NPQ_PKG_MGR=pnpm npq-hero"
```

The `NPQ_PKG_MGR` environment variable tells npq which package manager to delegate to after completing its checks.

## Exit Code Preservation

A critical requirement for the alias feature is that npq must preserve the exit code of the underlying package manager. Without this, CI pipelines and scripts that depend on exit codes (e.g. `npm audit` returning `1` when vulnerabilities are found) would silently pass.

### How it works

1. `packageManager.spawnPackageManager()` spawns the package manager using `child_process.spawn` with `stdio: 'inherit'` and returns a Promise that resolves with the child process's exit code (from the `close` event).

2. Both `bin/npq.js` and `bin/npq-hero.js` await this promise and set `process.exitCode` to the returned value:

```javascript
.then((status) => {
  if (status && status.install === true) {
    return pkgMgr.process(packageManagerTool)
  }
})
.then((exitCode) => {
  if (typeof exitCode === 'number') {
    process.exitCode = exitCode
  }
})
```

3. Using `process.exitCode` (rather than `process.exit()`) allows any pending I/O and cleanup to complete naturally before the process terminates.

### Examples of exit code behavior

| Scenario | Exit Code |
|----------|-----------|
| `npm install express` succeeds | `0` |
| `npm audit` finds vulnerabilities | `1` |
| `npm run build` fails | non-zero (whatever the script returns) |
| User aborts at the npq prompt (Ctrl+C) | `1` |
| npq encounters an internal error | `-1` |
| Unsupported Node version (with `npq`) | `-1` |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NPQ_PKG_MGR` | Package manager to delegate to | `npm` |
| `NPQ_DISABLE_AUTO_CONTINUE` | Set to `true` to always prompt instead of auto-continuing on warnings | `false` |

## Command Detection

`npq-hero` uses `CliParser.parseArgsMinimal()` with `earlyExitNoInstall = true` to determine if the command is an install. The following first-positional arguments are recognized as install commands:

- `install`, `i`, `add`
- Common misspellings: `isntall`, `in`, `ins`, `inst`, `insta`, `instal`, `isnt`, `isnta`, `isntal`

Any other first positional (e.g. `audit`, `test`, `run`, `ls`, `why`, `outdated`) results in an empty package list, triggering the passthrough behavior.

## Testing

### Unit tests

**`__tests__/packageManager.test.js`** -- Tests that `packageManager.process()` resolves with the child's exit code:

- Exit code `0` on success
- Exit code `1` on failure
- Exit code `2` and other non-zero codes
- Across different package managers (npm, yarn, pnpm)

### Integration tests

**`__tests__/exitCode.test.js`** -- Tests exit code propagation through both bin scripts:

- `npq-hero` sets `process.exitCode` to `1` when the package manager exits with `1`
- `npq-hero` sets `process.exitCode` to `0` when the package manager exits with `0`
- `npq-hero` propagates non-zero exit codes in silent/passthrough mode (non-install commands)
- `npq` sets `process.exitCode` correctly for both success and failure

### Alias setup tests

**`__tests__/scripts.test.js`** -- Tests the postinstall/preuninstall alias management:

- Postinstall adds aliases to the shell profile
- Postinstall does not create duplicate aliases
- Preuninstall removes aliases
- Postinstall skips unknown shells
- Postinstall skips when running under yarn or npm v7+
- Shell detection for bash and zsh

### Running the tests

```bash
# All tests
npm test

# Only exit code tests
npx jest __tests__/exitCode.test.js __tests__/packageManager.test.js

# Only alias setup tests
npx jest __tests__/scripts.test.js
```

### Requirements

- Node.js `>=20.13.0`
- Jest test framework (`npm test`)

## Key Source Files

| File | Purpose |
|------|---------|
| `bin/npq-hero.js` | Alias-compatible entry point, no own CLI flags |
| `bin/npq.js` | Standalone CLI entry point with full flag support |
| `lib/packageManager.js` | Spawns the package manager, returns exit code promise |
| `lib/cli.js` | Argument parsing, install command detection |
| `lib/helpers/cliSupportHandler.js` | Node version check, sync passthrough fallback |
| `scripts/postinstall.js` | Automatic alias setup on `npm install -g npq` |
| `scripts/preuninstall.js` | Alias removal on uninstall |
| `scripts/scriptHelpers.js` | Shell detection, alias strings, profile file helpers |
