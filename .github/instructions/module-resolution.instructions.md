---
applyTo: '**'
description: Module Resolution and Import Strategy
source: https://kashw1n.com/blog/nodejs-2025/
---

# Module Resolution & Import Strategy

Goal: make imports robust, refactor-friendly, and adaptive by using **internal import maps** + **dynamic imports**. Keep internal vs external deps clearly separated.

---

## Decision Rules

- **Internal modules (stable paths, refactor-safe):** Use **import maps** with `#aliases` for config, utilities, db, features.
- **Conditional/optional features or env-specific adapters:** Use **dynamic `import()`** with try/fallback logic.
- **Feature flags & code splitting:** Load modules lazily based on env/config to reduce startup and bundle size.
- **Distinguish ownership:** `#`-prefixed imports = internal; bare/URL imports = external.

---

## Internal Imports (Import Maps)

**Define aliases:**
```json
{
  "imports": {
    "#config": "./src/config/index.js",
    "#utils/*": "./src/utils/*.js",
    "#db": "./src/database/connection.js"
  }
}
````

**Use them in code:**

```js
import config from '#config';
import { logger, validator } from '#utils/common';
import db from '#db';
```

**Benefits**

* Paths don’t break when files move; central remap only.
* Clear boundary between **internal** (`#...`) and **external** deps.
* Faster refactors; fewer deep relative paths.

---

## Dynamic Imports (Flexible Loading)

**Env-driven adapter selection with safe fallback:**

```js
export async function loadDatabaseAdapter() {
  const dbType = process.env.DATABASE_TYPE || 'sqlite';
  try {
    const { default: adapter } = await import(`#db/adapters/${dbType}`);
    return adapter;
  } catch {
    console.warn(`Adapter ${dbType} missing; falling back to sqlite`);
    const { default: fallback } = await import('#db/adapters/sqlite');
    return fallback;
  }
}
```

**Feature flags / optional capabilities:**

```js
export async function loadOptionalFeatures() {
  const features = [];

  if (process.env.ENABLE_ANALYTICS === 'true') {
    const { default: analytics } = await import('#features/analytics');
    features.push(analytics);
  }
  if (process.env.ENABLE_MONITORING === 'true') {
    const { default: monitoring } = await import('#features/monitoring');
    features.push(monitoring);
  }
  return features;
}
```

**Benefits**

* Load only what’s needed for the current environment.
* Natural place to implement fallbacks and progressive enhancement.

---

## Best Practices

* **Keep aliases high-level:** map domains (`#config`, `#db`, `#utils/*`), not volatile file names.
* **One source of truth:** centralize mappings; don’t duplicate alias logic elsewhere.
* **Validate boundaries:** internal code imports `#...`; external libs stay bare (`react`, `node:fs`).
* **Guard dynamic imports:** wrap in `try/catch` with a **clear fallback** or user-facing warning.
* **Log decisions:** when falling back, log context (requested adapter/feature) to aid debugging.
* **Feature flags via env:** prefer explicit `ENABLE_*` env vars for optional modules.
* **Test both paths:** verify primary and fallback imports in CI (set env vars to exercise each branch).

---

## Antipatterns (Avoid)

* **Deep relative paths** (`../../../utils`) that break on refactors — replace with `#utils/...`.
* **Stringly-typed, scattered paths** — don’t hardcode file locations in many places; alias once.
* **Dynamic import without fallback** — leaves features broken silently; always handle `catch`.
* **Over-granular aliases** (`#utils/math/add.js`) — alias directories or stable entry points instead.
* **Mixing internal/external semantics** — don’t alias third-party packages under `#...`; keep them explicit.
