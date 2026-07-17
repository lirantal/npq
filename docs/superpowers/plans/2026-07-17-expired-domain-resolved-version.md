# Expired-Domain Requested-Version Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make expired-domain checks inspect maintainers from the package version npq will install instead of from the `latest` dist-tag.

**Architecture:** `ExpiredDomainsMarshall` will resolve the package selector against the pakument it already fetched through `BaseMarshall.resolvePackageVersion`. It will then select only that version's maintainer list, leaving the existing normalization, DNS, RDAP, warning, and `NotEvaluated` logic intact.

**Tech Stack:** Node.js 24, Jest 30, semver, Changesets.

## Global Constraints

- Base the implementation on `origin/main` through branch `work/fix-expired-domain-resolved-version`.
- Do not add registry, DNS, RDAP, or dependency requests beyond the existing marshall behavior.
- Preserve current warning-only account-takeover findings and `NotEvaluated` handling.
- Add a patch changeset for this user-visible correctness fix.
- Run `npm test`, `npm run lint`, and `npm run build` before handoff.

---

### Task 1: Capture requested-version regressions

**Files:**
- Modify: `__tests__/marshalls.expiredDomains.test.js`

**Interfaces:**
- Consumes: `ExpiredDomainsMarshall.validate({ packageName, packageVersion })`.
- Produces: regression coverage for exact versions, semver ranges, dist-tags, and unresolved selectors.

- [ ] **Step 1: Write failing tests**

Add a pakument fixture with maintainer domains that differ by version and a table-driven test that supplies the selector and expected domain:

```js
test.each([
  ['an exact older version', '1.0.0', 'exact.example.com'],
  ['a semver range', '^1.0.0', 'range.example.com'],
  ['a non-latest dist-tag', 'next', 'next.example.com']
])('checks maintainers for %s', async (_case, packageVersion, expectedDomain) => {
  const resolve = jest.fn().mockResolvedValue(['ns1.example.com'])
  const testMarshall = createMarshall({ resolve })

  await testMarshall.validate({ packageName: pakumentWithVersionedMaintainers, packageVersion })

  expect(resolve).toHaveBeenCalledWith(expectedDomain, 'NS')
  expect(resolve).not.toHaveBeenCalledWith('latest.example.com', 'NS')
})
```

Add an unresolvable-selector test that expects `NotEvaluated` and no DNS lookup:

```js
await expect(
  testMarshall.validate({ packageName: pakumentWithVersionedMaintainers, packageVersion: 'unknown' })
).rejects.toThrow(NotEvaluated)
expect(resolve).not.toHaveBeenCalled()
```

- [ ] **Step 2: Run the expired-domain test file to verify red**

Run: `npm test -- __tests__/marshalls.expiredDomains.test.js`

Expected: FAIL because the current implementation resolves `dist-tags.latest` and queries `latest.example.com` for every selector.

- [ ] **Step 3: Adapt existing test request fixtures**

Ensure existing direct calls to `validate` specify `packageVersion: 'latest'` where their fixture represents the latest release. This makes the selector contract explicit without changing each test's DNS/RDAP assertion.

- [ ] **Step 4: Commit the red test state only if it is useful to preserve**

Do not commit a deliberately failing state unless a separate review checkpoint requires it. Continue directly to the minimal implementation after recording the expected failure output.

### Task 2: Select maintainers from the resolved release

**Files:**
- Modify: `lib/marshalls/expiredDomains.marshall.js`
- Test: `__tests__/marshalls.expiredDomains.test.js`

**Interfaces:**
- Consumes: `this.resolvePackageVersion(packageName, versionSpec, pakument)` returning an exact version string or `null`.
- Produces: `maintainersAccounts` drawn only from `pakument.versions[resolvedVersion]`.

- [ ] **Step 1: Write the minimal implementation**

Replace the direct `latest` lookup at the start of `validate` with:

```js
const packageVersion = await this.resolvePackageVersion(
  pkg.packageName,
  pkg.packageVersion || 'latest',
  data
)
const versionData = packageVersion && data.versions && data.versions[packageVersion]
const maintainersAccounts = versionData && versionData.maintainers
```

Keep the existing `NotEvaluated` check immediately after this block. It handles both a `null` resolution and an absent maintainer list without a pass or a warning.

- [ ] **Step 2: Run the expired-domain test file to verify green**

Run: `npm test -- __tests__/marshalls.expiredDomains.test.js`

Expected: PASS, including the exact-version, range, dist-tag, and unresolvable-selector regressions.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: all suites pass with no coverage regression below configured thresholds.

### Task 3: Document the patch release

**Files:**
- Create: `.changeset/resolved-expired-domain-version.md`

**Interfaces:**
- Produces: a patch release note for package `npq`.

- [ ] **Step 1: Add the changeset**

Create a patch changeset with this content:

```md
---
'npq': patch
---

Check expired-domain risk using maintainers from the package version being installed instead of always using the latest release.
```

- [ ] **Step 2: Run final static and build verification**

Run: `npm run lint`

Expected: exit 0; existing warnings may remain unchanged.

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 3: Review the final diff and commit**

Run: `git diff --check` and `git status --short`.

Stage only the marshall, tests, changeset, design, and plan documents. Commit with:

```bash
git commit -m "fix: inspect resolved version for expired domains"
```
