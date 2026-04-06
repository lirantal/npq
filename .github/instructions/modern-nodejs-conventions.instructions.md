---
applyTo: '**'
description: Modern Node.js Programming Conventions
source: https://kashw1n.com/blog/nodejs-2025/
---


**Why these rules exist:**
These conventions ensure that agents produce Node.js code aligned with the current platform direction—cleaner module boundaries, modern async workflows, built-in tooling, and performance-aware patterns. Following these guidelines leads to code that is easier to maintain, more predictable, and takes full advantage of Node’s evolving standard library.

---

# Prefer ES Modules and Use the `node:` Prefix

**Why:**
ES Modules (`import`/`export`) are now the standard for modern JavaScript. Combined with the `node:` prefix, they make it unmistakably clear which dependencies come from the Node.js standard library versus installed packages. Agents should always use ES Modules unless they are explicitly modifying legacy CommonJS code.

```js
// math.js
export function add(a, b) {
  return a + b;
}

// app.js
import { add } from './math.js';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

console.log('Sum:', add(2, 3));
```

---

# Use Top-Level Await for Clean, Direct Initialization

**Why:**
Top-level `await` eliminates boilerplate wrapper functions and makes initialization flows more readable. Agents should use it whenever asynchronous setup is required at module load time.

```js
// app.js
import { readFile } from 'node:fs/promises';

const configRaw = await readFile('config.json', 'utf8');
const config = JSON.parse(configRaw);

console.log('Config loaded for:', config.appName);
```

---

# Prefer Built-in Testing Tools

**Why:**
Node’s built-in test runner is now robust enough for most projects—fast, dependency-free, and familiar to anyone using Jest/Mocha-style workflows. Agents should default to it to avoid unnecessary dependencies.

```js
// test/math.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { add, multiply } from '../math.js';

describe('math utilities', () => {
  test('add() sums correctly', () => {
    assert.strictEqual(add(2, 3), 5);
  });

  test('multiply() works async', async () => {
    assert.strictEqual(await multiply(2, 3), 6);
  });

  test('invalid inputs throw errors', () => {
    assert.throws(() => add('a', 'b'), /Invalid/);
  });
});
```

```sh
node --test                # Run all tests
node --test --watch        # Auto-rerun on file changes
node --test --experimental-test-coverage
```

---

# Prefer Async Iterators Over Traditional Events

**Why:**
Async iterators combine the flexibility of event emitters with the clarity and flow-control benefits of `for await` loops. They avoid callback hell, support graceful cancellation, and naturally handle backpressure.

```js
import { EventEmitter } from 'node:events';

class DataProcessor extends EventEmitter {
  async *processStream() {
    for (let i = 0; i < 5; i++) {
      this.emit('data', `chunk-${i}`);
      yield `processed-${i}`;
      await new Promise(r => setTimeout(r, 100));
    }
    this.emit('end');
  }
}

const processor = new DataProcessor();

// Consume as async stream
for await (const item of processor.processStream()) {
  console.log('Processed:', item);
}
```

---

# Use Worker Threads for CPU-Heavy Tasks

**Why:**
Node.js is single-threaded by default; CPU-intensive tasks block the event loop and make the entire app unresponsive. Worker threads allow agents to offload expensive work to separate threads without switching languages or architectures.

```js
// worker.js
import { parentPort, workerData } from 'node:worker_threads';

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.postMessage(fib(workerData.n));
```

```js
// main.js
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

export function runFib(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      fileURLToPath(new URL('./worker.js', import.meta.url)),
      { workerData: { n } }
    );

    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', code =>
      code === 0 || reject(new Error(`Worker exit: ${code}`))
    );
  });
}

console.log('Calculating...');
console.log('Result:', await runFib(40));
```

---

# Use Built-in Watch Mode for Development

**Why:**
Node.js includes built-in watch mode, eliminating external tools like `nodemon`. Agents should rely on this for hot-reload development workflows.

```json
{
  "name": "modern-node-app",
  "type": "module",
  "scripts": {
    "dev": "node --watch app.js",
    "test": "node --test --watch",
    "start": "node app.js"
  }
}
```

---

# Use Built-in `.env` File Support

**Why:**
Node now supports loading `.env` files natively, reducing dependency bloat and improving clarity around configuration loading.

```sh
node --env-file=.env app.js
```

---

# Use Node’s Built-in Performance Monitoring

**Why:**
Built-in performance APIs allow agents to instrument slow operations without pulling in heavy APM tools. This is especially helpful for diagnosing bottlenecks or monitoring expensive operations.

```js
import { PerformanceObserver, performance } from 'node:perf_hooks';

const obs = new PerformanceObserver(entries => {
  for (const entry of entries.getEntries()) {
    if (entry.duration > 100) {
      console.log(`Slow operation: ${entry.name} (${entry.duration}ms)`);
    }
  }
});

obs.observe({ entryTypes: ['function', 'measure'] });

async function processLargeDataset(data) {
  performance.mark('start-process');

  const result = await heavyProcessing(data);

  performance.mark('end-process');
  performance.measure('dataset-processing', 'start-process', 'end-process');

  return result;
}
```
