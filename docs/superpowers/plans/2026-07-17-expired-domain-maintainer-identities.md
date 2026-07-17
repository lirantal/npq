# Expired-Domain Maintainer Identity Warnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include the individual maintainers affected by each corroborated expired-domain warning.

**Architecture:** `ExpiredDomainsMarshall` will keep valid registry maintainer records in a second map keyed by the existing normalized email domain. The current deduplicated DNS, public-TLD, and RDAP flow will select corroborated domains as it does today, then format only those domains and their mapped maintainers into the local `Warning` message.

**Tech Stack:** Node.js 24, Jest 30, Changesets.

## Global Constraints

- Work only from branch `work/improve-expired-domain-warning` based on merged `origin/main` commit `ff70907`.
- Preserve the current package-version resolution, DNS classification, public-TLD validation, RDAP lookup, warning eligibility, and incomplete-record count.
- Output identities only in the local warning. DNS and RDAP requests must continue to receive normalized domains only.
- List corroborated domains in lexical order and maintainer records in their original registry order.
- Render a non-empty name as `name <email>` and a missing or blank name as `email`.
- Add a patch changeset and run `npm test`, `npm run lint`, and `npm run build` before handoff.

---

### Task 1: Capture attributable warning output

**Files:**
- Modify: `__tests__/marshalls.expiredDomains.test.js:189-218`

**Interfaces:**
- Consumes: `ExpiredDomainsMarshall.validate({ packageName, packageVersion })`.
- Produces: a regression assertion for grouped identities, lexical domain order, registry identity order, name fallback, and the existing incomplete-record suffix.

- [ ] **Step 1: Write the failing regression expectation**

Replace the current `orders suspected domains and reports other incomplete records` fixture with this maintainer list, preserving the existing DNS mock and `latest` selector:

```js
packageData([
  { name: "B first", email: "first@b-domain.com" },
  { name: "invalid", email: "" },
  { name: "timeout", email: "timeout@timeout-domain.com" },
  { name: "A", email: "a@a-domain.com" },
  { name: "B second", email: "second@b-domain.com" },
  { email: "nameless@a-domain.com" }
])
```

Replace the expected warning string with:

```text
Maintainer domains a-domain.com, b-domain.com do not resolve in public DNS, and RDAP found no active registration; account takeover may be possible.

Affected maintainers:
- a-domain.com: A <a@a-domain.com>, nameless@a-domain.com
- b-domain.com: B first <first@b-domain.com>, B second <second@b-domain.com>

2 other maintainer records could not be evaluated.
```

Keep `expect(resolve).toHaveBeenCalledWith("com", "NS")` so the test also protects the existing public-TLD check.

- [ ] **Step 2: Run the focused test to verify it is red**

Run: `npm test -- __tests__/marshalls.expiredDomains.test.js`

Expected: FAIL because the current warning contains only the corroborated domain summary and the incomplete-record suffix.

- [ ] **Step 3: Do not commit the red test state**

Leave the focused test failure uncommitted. Proceed directly to the minimal production implementation.

### Task 2: Map maintainers to corroborated domains

**Files:**
- Modify: `lib/marshalls/expiredDomains.marshall.js:46-57`
- Modify: `lib/marshalls/expiredDomains.marshall.js:141-151`
- Test: `__tests__/marshalls.expiredDomains.test.js:189-218`

**Interfaces:**
- Consumes: valid maintainer records and `normalizeMaintainerDomain(maintainerInfo.email)`.
- Produces: `maintainersByDomain`, a `Map<string, Array<{name?: string, email: string}>>`, used only while formatting `Warning` output.

- [ ] **Step 1: Keep valid maintainer records by normalized domain**

Alongside the existing `emailDomains` map, initialize and populate a maintainer-record map after the existing valid-email check:

```js
const emailDomains = new Map()
const maintainersByDomain = new Map()
let invalidMaintainers = 0

for (const maintainerInfo of maintainersAccounts) {
  const emailDomain = normalizeMaintainerDomain(maintainerInfo && maintainerInfo.email)

  if (!emailDomain) {
    invalidMaintainers += 1
    continue
  }

  emailDomains.set(emailDomain, (emailDomains.get(emailDomain) || 0) + 1)
  const domainMaintainers = maintainersByDomain.get(emailDomain) || []
  domainMaintainers.push(maintainerInfo)
  maintainersByDomain.set(emailDomain, domainMaintainers)
}
```

Do not change the `emailDomains` values or any DNS/RDAP input arrays. They continue to own deduplication and incomplete-record arithmetic.

- [ ] **Step 2: Format identities after the existing warning summary**

Before appending the existing incomplete-record suffix, append an identity section for `corroboratedDomains`:

```js
const affectedMaintainers = corroboratedDomains
  .map((domain) => {
    const identities = maintainersByDomain
      .get(domain)
      .map((maintainer) => {
        const name = typeof maintainer.name === "string" ? maintainer.name.trim() : ""
        return name.length > 0 ? `${name} <${maintainer.email}>` : maintainer.email
      })
      .join(", ")

    return `- ${domain}: ${identities}`
  })
  .join("\n")

message += `\n\nAffected maintainers:\n${affectedMaintainers}`
```

Place this block after the existing summary assignment and before `if (incompleteCount > 0)`. `corroboratedDomains` is already ordered by the sorted input domain list, and the new map preserves each domain list insertion order.

- [ ] **Step 3: Run the focused test to verify it is green**

Run: `npm test -- __tests__/marshalls.expiredDomains.test.js`

Expected: PASS. The assertion proves identity grouping, both ordering guarantees, blank-name fallback, and preserved incomplete-record wording.

- [ ] **Step 4: Run the complete test suite**

Run: `npm test`

Expected: all suites pass with no newly failing tests.

### Task 3: Document and release the user-visible warning change

**Files:**
- Modify: `docs/feature/expired-domains.md:22-28`
- Modify: `docs/README.md:88-96`
- Create: `.changeset/clear-maintainer-identities.md`
- Create: `docs/superpowers/plans/2026-07-17-expired-domain-maintainer-identities.md`

**Interfaces:**
- Produces: user-facing documentation that identifies the local-only identity output and a patch release note for package `npq`.

- [ ] **Step 1: Document warning attribution**

Add a `## Warning attribution` section before `## External requests and privacy` in `docs/feature/expired-domains.md`:

```md
## Warning attribution

When DNS and RDAP corroborate an expired-domain warning, NPQ lists the affected maintainers grouped beneath each domain. The local warning includes the registry name and email when a name is available, or the email alone when it is not. This makes the finding traceable during a security review.
```

In `docs/README.md`, add the plan entry below the existing expired-domain resolved-version plan:

```md
- [Expired-domain maintainer identity warnings](./superpowers/plans/2026-07-17-expired-domain-maintainer-identities.md) - test-first implementation plan for attributable expired-domain warnings.
```

- [ ] **Step 2: Add the patch changeset**

Create `.changeset/clear-maintainer-identities.md` with:

```md
---
"npq": patch
---

Show the maintainers affected by corroborated expired-domain warnings.
```

- [ ] **Step 3: Run final verification**

Run: `npm run lint`

Expected: exit 0. Existing warnings may remain unchanged.

Run: `npm run build`

Expected: exit 0.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Commit the implementation**

Stage only `lib/marshalls/expiredDomains.marshall.js`, `__tests__/marshalls.expiredDomains.test.js`, `docs/feature/expired-domains.md`, `docs/README.md`, `.changeset/clear-maintainer-identities.md`, and this plan. Commit with:

```bash
git commit -m "fix: identify maintainers in expired-domain warnings"
```
