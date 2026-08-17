# Project audit boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current project-mode audit boundary explicit in both user-facing documentation locations.

**Architecture:** This is a documentation-only clarification. The README will provide a concise project-mode caveat, while the JSON audit feature documentation will state the same dependency-discovery boundary beside its `package.json` behavior. `lib/helpers/sourcePackages.js` and all runtime behavior remain unchanged.

**Tech Stack:** Markdown, Git, npm lint scripts.

## Global Constraints

- Cover only declared direct dependencies in the current project's `package.json` (`dependencies` and `devDependencies`).
- State explicitly that lockfile sources and transitive dependencies are outside the current project-mode audit boundary.
- Do not change dependency discovery, audit behavior, or the existing general safety disclaimer.
- Do not add a changeset for this documentation-only clarification.
- Leave the unrelated untracked `.env.development` untouched.

---

## File Map

- Modify `/workspaces/npq/README.md` to clarify the project-mode behavior in the general usage section.
- Modify `/workspaces/npq/docs/feature/json-output.md` to clarify the project dependency discovery contract for JSON audits.
- Do not modify `/workspaces/npq/lib/helpers/sourcePackages.js`; it is the behavior being documented.

### Task 1: Clarify project-mode scope in the README

**Files:**
- Modify: `/workspaces/npq/README.md:213-214`

**Interfaces:**
- Consumes: The existing paragraph describing `npq` without an install subcommand.
- Produces: A user-facing statement that identifies direct `package.json` dependencies as the current project-mode audit input and excludes lockfiles and transitives.

- [ ] **Step 1: Add the project-mode boundary caveat**

Immediately after the existing project-mode paragraph, add:

```markdown

Project-mode audits currently cover only declared direct dependencies from the
current project's `package.json` (`dependencies` and `devDependencies`). They
do not read lockfiles or discover transitive dependencies.
```

- [ ] **Step 2: Check the README diff**

Run:

```sh
git diff -- README.md
git diff --check
```

Expected: The diff contains only the new project-mode caveat and `git diff --check` exits with status `0`.

- [ ] **Step 3: Commit the README clarification**

```sh
git add README.md
git commit -m "docs: clarify project audit scope in readme"
```

Expected: Git creates a commit containing only the README clarification.

### Task 2: Clarify JSON project discovery scope

**Files:**
- Modify: `/workspaces/npq/docs/feature/json-output.md:22-27`

**Interfaces:**
- Consumes: The existing JSON audit section that explains discovery from the current project's `package.json`.
- Produces: A feature-specific statement that identifies direct dependencies as the supported project-mode inputs and excludes lockfiles and transitives.

- [ ] **Step 1: Add the JSON audit boundary caveat**

Immediately after the `npq --json` project-audit example, add:

```markdown

Project-mode JSON audits currently cover only declared direct dependencies from
the current project's `package.json` (`dependencies` and `devDependencies`).
They do not read lockfiles or discover transitive dependencies.
```

- [ ] **Step 2: Check the JSON documentation diff**

Run:

```sh
git diff -- docs/feature/json-output.md
git diff --check
```

Expected: The diff contains only the new project-discovery caveat and `git diff --check` exits with status `0`.

- [ ] **Step 3: Commit the JSON documentation clarification**

```sh
git add docs/feature/json-output.md
git commit -m "docs: clarify json project audit scope"
```

Expected: Git creates a commit containing only the JSON documentation clarification.

### Task 3: Run final repository verification

**Files:**
- Verify: `/workspaces/npq/README.md`
- Verify: `/workspaces/npq/docs/feature/json-output.md`

**Interfaces:**
- Consumes: The two committed documentation changes.
- Produces: Evidence that the documentation changes introduce no whitespace errors or lint regressions.

- [ ] **Step 1: Confirm the working diff and status**

Run:

```sh
git diff --check
git status --short
```

Expected: `git diff --check` exits with status `0`; status shows only the pre-existing untracked `.env.development`, if it remains untracked.

- [ ] **Step 2: Run the repository lint checks**

Run:

```sh
npm run lint
```

Expected: ESLint and lockfile lint complete successfully with exit status `0`.

- [ ] **Step 3: Report verification scope**

Document that no runtime tests were added or required because the change only clarifies existing behavior and does not modify executable code.
