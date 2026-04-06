---
applyTo: '**'
description: File System Operations APIs in Node.js
source: https://nodejsdesignpatterns.com/blog/reading-writing-files-nodejs/ "Reading and Writing Files in Node.js - The Complete Modern Guide"
---

## Decision Tree (pick one)

- **Small/medium text or JSON (config, templates, ≤ a few MB):** use `node:fs/promises` -> `readFile` / `writeFile`. Avoid loading very large files fully in memory.
- **Large files (hundreds of MB/GB) or continuous processing:** use **Streams** (`createReadStream` / `createWriteStream`) to gain backpressure and constant memory.
- **Low-level, chunked control (random access, append in place, partial reads):** use **File Handles** (`fs/promises.open`, `.read`, `.write`, `.close`).
- **Batch operations over many small files:** keep each file op async; use bounded concurrency (`p-limit`) or `Promise.allSettled` to process in parallel safely.
- **Script/CLI where blocking is acceptable and simplicity matters:** consider **sync** variants (`readFileSync`) sparingly; **never** in web servers.

---

## Canonical Patterns & How-Tos

### 1) Promise-based basics (small to medium files)
Use `node:fs/promises` with `async/await`. Prefer specifying encoding for text. Handle common error codes.

```js
import { readFile, writeFile } from 'node:fs/promises';

const txt = await readFile('config.json', 'utf8'); // 'utf8' => string
await writeFile('out.txt', 'hello\n', { flag: 'w' }); // creates or overwrites
````

* Common errors to branch on: `ENOENT`, `EACCES`, `EISDIR`, `ENOSPC`, `EMFILE`. Use `error.code`.
* Use top-level `await` in ESM when appropriate.

---

### 2) Binary data (buffers)

When no encoding is provided, `readFile` returns a `Buffer`. Convert explicitly or use `TextDecoder` when needed.

```js
const buf = await readFile('image.bin'); // Buffer
// ... work with buf, or new TextDecoder('utf8').decode(buf)
```

---

### 3) Concurrency across many files

Fan out async operations; cap concurrency for large sets.

```js
const files = ['a.txt','b.txt'];
const results = await Promise.allSettled(files.map(f => readFile(f, 'utf8')));
```

* Use `Promise.all()` for small sets; prefer **bounded** concurrency for larger sets to avoid too many open files (`EMFILE`).

---

### 4) Directories & relative paths

Use `fs/promises.readdir` + `path` utilities; prefer `import.meta.dirname` (or `__dirname` in CJS) to compute paths relative to the current file.

---

### 5) Large files — Streams (preferred)

Streams process data incrementally, support **backpressure**, and keep memory flat.

```js
import { createReadStream, createWriteStream } from 'node:fs';
createReadStream('big.csv')
  .pipe(createWriteStream('copy.csv'))
  .on('finish', () => console.log('done'));
```

* Backpressure lets slow destinations throttle sources automatically; use `.pipe()` to get correct flow control. Tune with `highWaterMark` only when necessary.

---

### 6) Low-level control — File Handles

For random access, partial reads/writes, incremental append, or when you must manage the file position:

```js
import { open } from 'node:fs/promises';

const fh = await open('data.bin', 'r+');
try {
  const { bytesRead, buffer } = await fh.read({ buffer: Buffer.alloc(1024), position: 0 });
  const { bytesWritten } = await fh.write(Buffer.from('ABC'), 10);
} finally {
  await fh.close();
}
```

* Always `close()` to avoid FD leaks; be careful mixing `read`/`write` with `readFile`/`writeFile` on the same handle because of file position semantics. Prefer a write stream for repeated writes.

---

## File System API Best Practices (do this)

* **Prefer async `fs/promises`** APIs for most work; they are non-blocking and fit `async/await`.
* **Choose streams for large files** to avoid loading everything into memory; rely on `.pipe()` to get backpressure.
* **Bound concurrency** when touching many files to prevent `EMFILE` and I/O contention.
* **Handle specific error codes** (`ENOENT`, `EACCES`, `ENOSPC`, etc.) and provide fallbacks or clear messages.
* **Pin flags intentionally** (e.g., `'r'`, `'w'`, `'a'`, `'r+'`) and set encodings for text I/O.
* **Close file handles** in `finally{}`; auto-closing streams is default, but explicit is safer for manual flows.
* **Keep memory flat**: avoid `readFile` on files >~100 MB; use streams or chunked reads.

---

## File System API Antipatterns (avoid this)

* **Reading huge files with `readFile`** (loads entire file into RAM) — use streams or chunked file handles.
* **Unbounded parallelism** over thousands of files — causes `EMFILE` and thrashes disk. Bound it.
* **Forgetting to close file handles** — leaks descriptors and can block process exit. Always `await fh.close()`.
* **Manual buffering glue between streams** instead of piping — defeats backpressure. Prefer `.pipe()` or `pipeline()`.
* **Using sync APIs in servers** — they block the event loop and tank throughput. Keep sync to small CLIs/migrations.

---

## Error Handling Cheatsheet

Check `error.code` and branch:

* `ENOENT` → file not found: suggest creating defaults or verifying path
* `EACCES` → permission denied: escalate or ask for elevated rights
* `ENOSPC` → disk full: surface a clear, user-visible error
* `EMFILE` → too many open files: bound concurrency / close FDs aggressively
* `EISDIR` → attempted to read a directory as a file

Prefer **`try/catch` around each op**, and for batches, use `Promise.allSettled` to collect per-file failures.

---

## Performance Notes

* Streams + backpressure keep memory stable; only tune `highWaterMark` when profiling shows a need.
* When writing many small chunks repeatedly, prefer a **write stream** over repeated `filehandle.write()` calls.
* For append-only logs, open with `'a'` and reuse a writable stream.

---

## Security & Safety

* Never trust file paths from user input; normalize/validate. (Path traversal)
* Do not log sensitive file contents; scrub secrets.
* Avoid `eval` on file contents; parse safely (e.g., `JSON.parse` with try/catch).
