# Coding-Agent Detection Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand npq's coding-agent detector to recognize all remaining direct and contextual signals identified by the `std-env` comparison, with matching documentation and regression tests.

**Architecture:** Keep detection in the existing local CommonJS helper consumed by both parsers. Direct environment variables remain in one frozen exported list; Pi, Devin, and Kiro use small contextual matchers in the same helper, with an injectable stdout-TTY option for deterministic tests. Downstream JSON routing remains unchanged.

**Tech Stack:** Node.js CommonJS, Jest 30, ESLint 9, Changesets, Markdown.

## Global Constraints

- Preserve all existing signals: `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CURSOR_AGENT`, `PI_CODING_AGENT`, `CODEX_SANDBOX`, `CODEX_THREAD_ID`, `GEMINI_CLI`, `WINDSURF_AGENT`, `CODEIUM_AGENT`, `AGENT`, and `AI_AGENT`.
- Add direct signals: `CLAUDE_CODE`, `REPL_ID`, `OPENCODE`, `AUGMENT_AGENT`, `GOOSE_PROVIDER`, `JUNIE_DATA`, and `JUNIE_SHIM_PATH`.
- Treat direct signals as active only when their values are non-empty strings.
- Match Pi from `PATH` containing `.pi/agent` with either slash direction.
- Match Devin from `EDITOR` containing `devin`, case-insensitively.
- Match Kiro from `TERM_PROGRAM` containing `kiro`, case-insensitively, only when stdout is not a TTY.
- Keep `REPL_ID` as a direct signal and document that ordinary Replit runtimes may select audit-only JSON mode.
- Do not add a dependency or change parser behavior, JSON schema, statuses, exit codes, or package-manager routing.
- Preserve the user's untracked `.env.development` file and unrelated worktree changes.

---

### Task 1: Add failing coverage for all new detector signals

**Files:**
- Modify: `__tests__/codingAgentEnvironment.test.js`

**Interfaces:**
- Tests consume `CODING_AGENT_ENVIRONMENT_VARIABLES` and `isCodingAgentEnvironment(env, options)` from `lib/helpers/codingAgentEnvironment.js`.
- Tests define the exact direct-signal list and the contextual matching contract before production code changes.

- [ ] **Step 1: Extend the expected direct signal list**

Add the seven new direct variables to `expectedSignals`, keeping the existing eleven entries unchanged:

```js
  'CLAUDE_CODE',
  'REPL_ID',
  'OPENCODE',
  'AUGMENT_AGENT',
  'GOOSE_PROVIDER',
  'JUNIE_DATA',
  'JUNIE_SHIM_PATH'
```

- [ ] **Step 2: Add failing contextual matcher tests**

Add these tests to `__tests__/codingAgentEnvironment.test.js`:

```js
  test('detects Pi from a POSIX agent path', () => {
    expect(isCodingAgentEnvironment({ PATH: '/home/user/.pi/agent/bin' })).toBe(true)
  })

  test('detects Pi from a Windows agent path', () => {
    expect(isCodingAgentEnvironment({ PATH: 'C:\\Users\\user\\.pi\\agent\\bin' })).toBe(true)
  })

  test('does not detect Pi from an unrelated path', () => {
    expect(isCodingAgentEnvironment({ PATH: '/home/user/.pilot/bin' })).toBe(false)
  })

  test('detects Devin from the editor name case-insensitively', () => {
    expect(isCodingAgentEnvironment({ EDITOR: '/usr/local/bin/DeViN' })).toBe(true)
  })

  test('does not detect Devin from an unrelated editor', () => {
    expect(isCodingAgentEnvironment({ EDITOR: '/usr/bin/code' })).toBe(false)
  })

  test('detects Kiro only when stdout is not a TTY', () => {
    const env = { TERM_PROGRAM: 'Kiro' }

    expect(isCodingAgentEnvironment(env, { stdoutIsTTY: false })).toBe(true)
    expect(isCodingAgentEnvironment(env, { stdoutIsTTY: true })).toBe(false)
  })

  test('does not detect Kiro from an unrelated terminal program', () => {
    expect(
      isCodingAgentEnvironment({ TERM_PROGRAM: 'vscode' }, { stdoutIsTTY: false })
    ).toBe(false)
  })
```

- [ ] **Step 3: Run the detector test and verify the new assertions fail**

Run:

```bash
npx jest __tests__/codingAgentEnvironment.test.js --runInBand --coverage=false
```

Expected: FAIL because the exported list lacks the seven new direct variables, and the helper does not yet implement the Pi, Devin, or Kiro matchers.

### Task 2: Implement the local detector matchers

**Files:**
- Modify: `lib/helpers/codingAgentEnvironment.js`
- Test: `__tests__/codingAgentEnvironment.test.js`

**Interfaces:**
- Consumes: environment objects and optional `{ stdoutIsTTY }` test/runtime context.
- Produces: `isCodingAgentEnvironment(env = process.env, options = {})` returning a boolean and the expanded frozen `CODING_AGENT_ENVIRONMENT_VARIABLES` list.

- [ ] **Step 1: Add the seven direct variables to the frozen list**

Extend the current array with the exact names below:

```js
  'CLAUDE_CODE',
  'REPL_ID',
  'OPENCODE',
  'AUGMENT_AGENT',
  'GOOSE_PROVIDER',
  'JUNIE_DATA',
  'JUNIE_SHIM_PATH'
```

- [ ] **Step 2: Implement the contextual checks after direct-signal checks**

Use this minimal implementation shape in `lib/helpers/codingAgentEnvironment.js`:

```js
function hasNonEmptyValue(env, name) {
  return typeof env[name] === 'string' && env[name].length > 0
}

function isCodingAgentEnvironment(
  env = process.env,
  { stdoutIsTTY = process.stdout?.isTTY } = {}
) {
  if (CODING_AGENT_ENVIRONMENT_VARIABLES.some((name) => hasNonEmptyValue(env, name))) {
    return true
  }

  if (typeof env.PATH === 'string' && /\.pi[\\/]agent/.test(env.PATH)) {
    return true
  }

  if (typeof env.EDITOR === 'string' && /devin/i.test(env.EDITOR)) {
    return true
  }

  return !stdoutIsTTY && typeof env.TERM_PROGRAM === 'string' && /kiro/i.test(env.TERM_PROGRAM)
}
```

Keep the existing CommonJS exports and do not import `std-env`.

- [ ] **Step 3: Run the focused detector tests and verify they pass**

Run:

```bash
npx jest __tests__/codingAgentEnvironment.test.js --runInBand --coverage=false
```

Expected: PASS with the expanded direct-signal cases and all contextual matcher tests green.

- [ ] **Step 4: Commit the detector implementation**

```bash
git add lib/helpers/codingAgentEnvironment.js __tests__/codingAgentEnvironment.test.js
git commit -m "feat: expand coding-agent detection signals"
```

### Task 3: Document the expanded detection contract

**Files:**
- Modify: `README.md:230-238`
- Modify: `docs/feature/json-output.md:29-68`

**Interfaces:**
- Documentation consumes the detector contract from Task 2; no code interface changes are introduced.

- [ ] **Step 1: Update the JSON-output signal table**

Add rows for `CLAUDE_CODE`, `REPL_ID`, `OPENCODE`, `AUGMENT_AGENT`, `GOOSE_PROVIDER`, and `JUNIE_DATA`/`JUNIE_SHIM_PATH`. Add rows describing the contextual `PATH`, `EDITOR`, and `TERM_PROGRAM` matchers, including Kiro's non-TTY safeguard. State that `REPL_ID` can also be present in ordinary Replit runtimes and still selects JSON mode.

- [ ] **Step 2: Keep the README note concise and linked**

Retain the existing automatic-detection explanation and add a sentence linking readers to the full signal table in `docs/feature/json-output.md#coding-agent-detection`, rather than duplicating the complete table in the root README.

- [ ] **Step 3: Review the rendered Markdown text**

Run:

```bash
sed -n '225,245p' README.md
sed -n '29,80p' docs/feature/json-output.md
```

Confirm all direct and contextual signals are named and the Kiro and Replit caveats are visible.

- [ ] **Step 4: Commit the documentation**

```bash
git add README.md docs/feature/json-output.md
git commit -m "docs: document expanded coding-agent detection"
```

### Task 4: Add release metadata and run repository verification

**Files:**
- Create: `.changeset/coding-agent-signal-coverage.md`

**Interfaces:**
- The changeset describes the published behavior change for the root `npq` package.

- [ ] **Step 1: Add the changeset**

Create `.changeset/coding-agent-signal-coverage.md` with:

```md
---
'npq': patch
---

Expand coding-agent detection to cover Claude Code, Replit, OpenCode, Auggie,
Goose, Junie, Pi path-based sessions, Devin editor sessions, and non-interactive
Kiro sessions.
```

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: exit code `0` with no failed tests.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code `0` with no ESLint or lockfile-lint errors.

- [ ] **Step 4: Inspect the final diff and worktree**

Run:

```bash
git diff --check HEAD~3..HEAD
git status --short
git diff --stat HEAD~3..HEAD
```

Confirm only the detector, its tests, documentation, changeset, and the already committed design/plan records changed; confirm `.env.development` remains untracked and untouched.

- [ ] **Step 5: Commit the release metadata**

```bash
git add .changeset/coding-agent-signal-coverage.md
git commit -m "chore: add coding-agent detection changeset"
```
