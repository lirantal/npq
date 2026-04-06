---
applyTo: '**'
description: Modern Node.js APIs Preference over Third-Party Dependency Bloat
source: https://nodesource.com/blog/nodejs-features-replacing-npm-packages
---

# Prefer Built-ins Over Dependencies (Node.js)

## Goal
Use modern **Node.js core APIs** instead of third-party packages when equivalent features exist. Benefits: fewer deps, smaller attack surface, easier upgrades.

---

## Quick Decision Rules
- If a **stable** Node core API exists for your use case, prefer it; only add a dep for missing features or required back-compat.
- If the core API is **experimental**, you may use it behind flags or keep the library until stable. Document the plan to migrate.
- When a feature depends on **recent Node versions**, gate by `engines` in `package.json` and CI runtime.

---

## Use-Case Index → Built-in API (and when to keep the lib)

### HTTP / Networking
- **HTTP fetch client:** Use global `fetch()` (Node ≥18). Keep `node-fetch` only for pre-18 support.
- **WebSocket client:** Use global `WebSocket` (experimental, Node 21+). Keep `ws` for server use or when you need stability/features.

### Testing
- **Test runner:** Use `node:test` (stable in Node 20). Keep Jest/Mocha if you need snapshots/mocking/plugins or the project depends on a third-party testing framework.

### Files & Directories
- **Glob patterns:** Use `fs.promises.glob()` (Node 22+). Keep `glob` for older Node versions.
- **Remove dirs recursively:** Use `fs.rm(path, { recursive:true, force:true })` instead of `rimraf`.
- **Create dirs recursively:** Use `fs.mkdir(path, { recursive:true })` instead of `mkdirp`.

### Text Styling & ANSI
- **Colored console output:** Use `util.styleText()` instead of `chalk`, `kleur`, or `colors`. 
- **Strip ANSI:** Use `util.stripVTControlCharacters()` instead of `strip-ansi`.

### IDs, Encoding, URLs
- **UUID v4:** Use `crypto.randomUUID()` instead of `uuid`.
- **Base64 helpers:** Use `atob/btoa` globals (plus `Buffer`) instead of polyfills.
- **URL routing/patterns:** Use global `URLPattern` (experimental). Keep `url-pattern` if you need stability.

### Configuration
- **Environment files:** Use `node --env-file=.env` instead of `dotenv`.

### Events
- **DOM-style events:** Use global `EventTarget` instead of `event-target-shim` when you want standards-based events (not `EventEmitter`).

### Data / Storage
- **SQLite:** Prefer `node:sqlite` when it fits (experimental). Keep `sqlite3`/`better-sqlite3` for mature features/perf until stable.

### TypeScript (execution)
- **Run TS directly:** `node --experimental-strip-types app.ts` for basic transpile. Keep `tsc/ts-node` for type-checking, declarations, builds.

### Cancellation
Operation cancellation: Use `AbortController` and pass its `signal` to APIs that support it (e.g., `fetch`, some stream/file/db clients). Keep cancel libs only when an API does not accept a signal.

```js
// Cancel long-running operations cleanly
const controller = new AbortController();

// Auto-cancel after 10s (or cancel on user action)
setTimeout(() => controller.abort(), 10_000);

try {
  const res = await fetch('https://slow-api.com/data', { signal: controller.signal });
  const data = await res.json();
  console.log('Data received:', data);
} catch (error) {
  if ((error as Error).name === 'AbortError') {
    console.log('Request was cancelled — expected behavior');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

Notes:
- Reuse the same controller to cancel multiple related ops together.
- Prefer timeouts via `AbortController` rather than ad-hoc timers that ignore the underlying task.
- Treat cancellation as a first-class outcome (log at info level, don’t convert to generic errors).

---

## Antipatterns to Avoid
- **Adding a package that duplicates a built-in** available in your supported Node version. (E.g., adding `uuid` on Node ≥14.17, or `rimraf` on Node ≥14.)
- **Keeping old deps “just in case”** after migrating — this bloats attack surface and maintenance. Clean up in the same PR.
- Manual boolean flags / “isCancelled” checks instead of `AbortController` — brittle and easy to forget in nested calls.
- Swallowing `AbortError` as a failure — cancellation is expected; don’t treat it as an application error.
- Starting uncancellable work (e.g., streams/DB ops) without threading a `signal` when the API supports one.
