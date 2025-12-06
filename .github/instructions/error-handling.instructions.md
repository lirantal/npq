---
applyTo: '**'
description: Error Handling and Diagnostics in Node.js
---

# Error Handling & Diagnostics (Node.js/TS)

Goal: produce **structured, contextual errors** that are easy to debug, log, monitor, and chain—without losing the original failure cause.

---

## Decision Rules

- **App-level errors** → use a **custom error class** that captures `code`, `statusCode`, `context`, `timestamp`, and supports JSON serialization.
- **Wrapping lower-level failures** → rethrow with `new Error(msg, { cause })` (or your custom class with a `cause` field) to preserve the original error and stack.
- **TypeScript** → remember `catch (e)` is `unknown`; **narrow** or cast before using (`e as Error`) when passing as `cause`.
- **Diagnostics** → always include minimal, non-sensitive context (what, where, ids)—not secrets or PII.

---

## Structured Errors (baseline)

```ts
// app/errors.ts
export class AppError extends Error {
  code: string;
  statusCode: number;
  context: Record<string, unknown>;
  timestamp: string;

  constructor(
    message: string,
    code: string,
    statusCode = 500,
    context: Record<string, unknown> = {},
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      // Optional: include cause message safely if it is an Error
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

// Usage with rich context (consistent interface across the app)
throw new AppError(
  "Database connection failed",
  "DB_CONNECTION_ERROR",
  503,
  { host: "localhost", port: 5432, retryAttempt: 3 }
);
````

---

## Error Cause (chaining the root failure)

Use `Error`’s options object with `{ cause }` when catching and rethrowing to attach the original error. This preserves context and stack across layers.

```ts
try {
  await doNetworkCall();
} catch (e) {
  // TS note: e is unknown → narrow/cast before passing as cause
  throw new Error("Fetching user profile failed", { cause: e as Error });
}
```

**With Response objects (better diagnostics):**

```ts
const response = new Response("test", { status: 400 });

// Bad (stringifies Response as [object Response])
console.error(new Error("Bad response: " + response));

// Good (preserves full object under [cause])
console.error(new Error("Bad response", { cause: { response } }));
```

**Real-world pattern:** when processing a `.md` file fails, show both the file path and the low-level parser error:

```ts
try {
  return await parseMarkdown(filePath);
} catch (err) {
  throw new AppError(
    `Failed to process markdown`,
    "MD_PARSE_ERROR",
    422,
    { filePath },
    { cause: err as Error }
  );
}
```

---

## Error Handling Best Practices

* **Always preserve the root cause** when layering errors: `throw new Error("high-level", { cause: err })`.
* **Prefer one custom base class** (`AppError`) with `code`, `statusCode`, `context`, `timestamp`. Keep it small and serializable.
* **Use context, not blobs:** add *pertinent* fields (ids, file paths, operation) to `context`; avoid secrets/large payloads.
* **TS-safe catches:** treat caught errors as `unknown`; refine (e.g., `instanceof Error`) or cast before accessing `.message`/passing as `cause`.
* **Log clearly:** when logging/serializing, include `error.toJSON?.()` if present, plus `error.cause` (recursively if you need deep chains).
* **User vs operator messages:** top-level `message` should be actionable (for logs/ops). Map to user-facing messages elsewhere.

---

## Error Handling Antipatterns (avoid)

* **Swallowing errors** or rethrowing without the original cause → loses vital context. Use `{ cause }`.
* **Throwing raw strings** (e.g., `throw "oops"`): breaks tooling/typing. Always throw `Error` or `AppError`.
* **Overstuffing context** with secrets/PII or huge objects (Responses/buffers) → log bloat, risk. Put *summaries* or safe fields in `context`; if you need a large object for local inspection, put it under `cause` carefully.
* **Multi-style errors** scattered across codebase (inconsistent shape) → standardize on `AppError`.

---

## Error Handling: Minimal Recipes

**Wrap & rethrow with cause (generic):**

```ts
export async function doTask() {
  try {
    await risky();
  } catch (e) {
    throw new Error("Task failed", { cause: e as Error });
  }
}
```

**HTTP handler (Fetch style):**

```ts
try {
  const res = await fetch(url);
  if (!res.ok) {
    throw new AppError(
      "Upstream returned error",
      "UPSTREAM_BAD_STATUS",
      res.status,
      { url, status: res.status },
      { cause: new Error(await res.text()) }
    );
  }
  return await res.json();
} catch (e) {
  // Central place can log error.toJSON() and expose safe message to clients
  throw e;
}
```

---

## Advanced Diagnostics (Custom Channels)

Use **`node:diagnostics_channel`** to publish/subscribe to app-level diagnostic events without coupling your business logic to logging/monitoring.

```ts
import diagnostics_channel from "node:diagnostics_channel";

// Create custom diagnostic channels
const dbChannel = diagnostics_channel.channel("app:database");
const httpChannel = diagnostics_channel.channel("app:http");

// Subscribe to diagnostic events
dbChannel.subscribe((message) => {
  console.log("Database operation:", {
    operation: message.operation,
    duration: message.duration,
    query: message.query,
  });
});

// Publish diagnostic information
export async function queryDatabase(sql: string, params: unknown[]) {
  const start = performance.now();
  try {
    const result = await db.query(sql, params);

    dbChannel.publish({
      operation: "query",
      sql,
      params,
      duration: performance.now() - start,
      success: true,
    });

    return result;
  } catch (error) {
    dbChannel.publish({
      operation: "query",
      sql,
      params,
      duration: performance.now() - start,
      success: false,
      error: (error as Error).message,
    });
    throw error;
  }
}
```

### Diagnostics Best Practices

* **Name channels by domain** (`app:database`, `app:http`, `app:featureX`) for easy routing.
* **Keep subscribers fast & safe:** work they do happens in-process—avoid heavy/async work directly in the callback; forward to your logger/queue.
* **Emit minimal, structured payloads:** operation, duration, identifiers—no secrets/PII.
* **Pair with errors:** when publishing failures, include the related `AppError`’s `code` and a short summary (full details live in logs).
* **Sample when needed:** for very hot paths, add sampling or level control to reduce noise and overhead.
* **Test observability paths:** have tests that assert a publish happens for both success and failure branches.

### Diagnostics Antipatterns (to avoid)

* **Spamming channels with raw payloads** (big objects/rows) → log bloat, perf hit.
* **Doing blocking work in subscribers** → slows the hot path; offload.
* **Inconsistent message shapes** across publishes → hard to parse/monitor; keep a schema-like shape per channel.
