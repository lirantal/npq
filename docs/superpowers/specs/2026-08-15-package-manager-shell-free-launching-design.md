# Shell-Free Package Manager Launching Design

**Status:** Approved for implementation

## Problem

`lib/packageManager.js` currently joins the original CLI arguments into one shell command string and starts it with `shell: true`. Any shell metacharacters present in an argument can therefore be interpreted by the shell instead of being delivered literally to the selected package manager.

This change is separate from lockfile handling and is limited to the package-manager process boundary.

## Goals

- Pass the selected package manager as the executable and the forwarded CLI values as a separate argument array.
- Set `shell: false` explicitly.
- Preserve argument order and argument boundaries, including values containing spaces or shell metacharacters.
- Preserve the existing filtering of NPQ-only forwarding flags.
- Keep documented package-manager configuration working on Unix-like systems and Windows.
- Add regression coverage for the executable, argument array, and shell option.

## Non-goals and compatibility

- Do not support `NPQ_PKG_MGR` values that contain an executable plus embedded shell arguments. The documented contract is a package-manager executable name such as `npm`, `yarn`, or `pnpm`; accepting a full shell command would require reconstructing or parsing a command string and would undermine this hardening.
- Do not change lockfile behavior.
- Do not alter package-manager exit-code propagation.
- Do not change the separate low-runtime-version passthrough path in `lib/helpers/cliSupportHandler.js`.

## Design

`spawnPackageManager()` will derive the forwarded arguments directly from `process.argv.slice(2)`, filter NPQ-owned flags as it does today, and call the `cross-spawn` adapter with `executable`, `args`, `stdio: 'inherit'`, and `shell: false`.

`cross-spawn` provides the platform-compatible launcher behavior needed for Windows package-manager shims while preserving the executable-plus-argument-array contract at this module boundary. Its Windows adapter escapes command-interpreter metacharacters when a `.cmd` or `.bat` shim must be used; `packageManager.js` rejects carriage returns and line feeds before invoking it, does not construct a command string, and does not invoke `cmd.exe` directly.

Spawn errors will reject the returned Promise so missing or non-executable package-manager values reach the existing CLI error handling rather than becoming uncaught child-process events.
## Testing

The package-manager unit tests will verify:

1. no arguments launches the selected executable with an empty argument array;
2. ordinary arguments are forwarded as individual array entries in their original order;
3. arguments containing shell metacharacters remain single array entries;
4. NPQ-only flags remain filtered; and
5. every launch uses `stdio: 'inherit'` and `shell: false`.

Existing exit-code tests will remain in place to ensure the process result is unchanged.
