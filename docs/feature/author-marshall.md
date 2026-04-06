# Author Marshall

## What it does and why it matters

The **Author Marshall** is a supply-chain check that runs while npq audits a package. It inspects **who** published the specific version you are installing and **how recently** that version was published.

That matters because two common risk patterns on npm are:

1. **Account takeover or maintainer change** — Someone new starts publishing versions of a package that used to belong to someone else. If their **first** release under that identity is **brand new**, you may want to pause before installing.
2. **Very fresh releases** — A tarball published **days ago** has had little time for community review, security tooling, or reputation to catch problems. That risk exists even for long-tenured maintainers.

Older approaches sometimes **mixed** those ideas (for example, treating “this is the maintainer’s only version ever” the same as “this version was published yesterday”). That produced **noise** for healthy packages: many small or stable packages have a single release from years ago, which is not the same risk as a **new** first publish.

The Author Marshall **separates** the two concerns: one check focuses on **publisher history for this package**, the other on **age of the version you install**, with explicit day thresholds.

---

## The two checks (with examples)

### 1. New author (first publish for this user on this package)

**Intent:** Flag situations where the version you install is the **first** version ever published to this package by this npm user (matched by `_npmUser.email`), **and** that publish is **recent**.

**Rule (simplified):** If the installed version is that user’s first publish for the package **and** it was published **within the last 21 days**, npq throws an **Error** and blocks the install flow like other marshall errors.

**Example A — Quiet (not flagged):** Package `ncp`-style scenario: the **latest** version is still the **only** version, and it was published **years** ago. That is “first publish” in a historical sense, but it is **not** a hot takeover signal today, so **no error** from this check.

**Example B — Flagged:** A package had releases from `alice@…` for years; a new version appears from `bob@…` and it is Bob’s **first** version on that package, published **5 days** ago. That is the kind of “new publisher + very recent” combination this check targets.

**Example C — Not the focus of this check:** Bob’s first version was published **60 days** ago. The new-author branch does not fire the 21-day rule (though the **version recency** check below may still apply if that version is young enough in absolute terms—see thresholds).

---

### 2. Version recency (how new is this tarball?)

**Intent:** Flag **very recently published** versions **regardless** of whether the author is new to the package. This is about **time on npm**, not author history.

**Rules:**

- The strict logic only runs when the installed version is **at most 45 days** old (older versions skip this block).
- **≤ 7 days** old → **Error** (treated as high concern).
- **8–30 days** old → **Warning** (moderate concern; may still proceed depending on npq prompts and auto-continue behavior).
- **31–45 days** old → no error or warning from this block.

**Example D — Error:** `lodash@x.y.z` was published **3 days** ago by a well-known maintainer. Author history might be boring; the marshall still **errors** because the artifact is extremely fresh.

**Example E — Warning:** Published **20 days** ago → **Warning** only (not an error).

**Example F — No recency flag:** Published **50 days** ago → outside the 45-day window for this check; no recency error/warning from the Author Marshall.

---

### How the two checks fit together

| Lens | Question |
|------|----------|
| **New author check** | “Is this the publisher’s **first** version on this package **and** was that first publish **within 21 days**?” |
| **Version recency check** | “Was this **version** published within **7 / 30 / 45 days**?” |

They are **complementary**: one stresses **trust in a new publisher on this package**, the other stresses **maturity of the release** itself.

---

## How the Author Marshall works (implementation overview)

**Location:** `lib/marshalls/author.marshall.js`  
**Category:** Supply Chain Security (`marshallCategories.SupplyChainSecurity`)

### High-level flow

1. **Load registry metadata**  
   Fetches the full package document (`pakument`) for `pkg.packageName` via `packageRepoUtils.getPackageInfo`.

2. **Resolve the concrete semver**  
   Uses `packageRepoUtils.getSemVer` so the check applies to the **resolved** version (e.g. after resolving a range or tag), not only the string the user typed.

3. **Resolve the publishing user**  
   Reads `pakument.versions[packageVersion]._npmUser`.  
   - Missing user or email → **Error** (“Could not determine publishing user…”).  
   - Email must pass a **simple format regex** (see Colin’s “reasonable email regex” note in code); invalid → **Error**.

4. **Find “first version for this user”**  
   The code scans `pakument.versions` and keeps the **first** entry whose `_npmUser.email` matches the current publisher’s email (iteration follows `Object.values` order).  
   - **Note:** Registry JSON does not guarantee that iteration order matches strict chronological publish order; the condition used in code is aligned with “first matching version record for this email in that traversal,” combined with `firstVersionForUser.version === packageVersion` for the strict “this install is that first record” case.

5. **New author check**  
   If there is no prior version for that email, **or** the first matching version **is** the installed version, then if `pakument.time[packageVersion]` exists, compute age in whole days. If **≤ 21 days**, throw the **new author** `Error`.

6. **Version recency check**  
   Compute days since `pakument.time[packageVersion]` (same date string as above). If **≤ 45** days, apply **≤ 7** → `Error`, **≤ 30** → `Warning` (the 7-day branch runs first, so very fresh releases are errors, not warnings).

7. **Success**  
   If nothing threw, the marshall returns the version’s publish date string for downstream use.

### Prerequisites and edge behavior

- **`versionPublishedDateString`:** If it were missing, the new-author block is skipped when it depends on that field; the recency block still runs with `new Date(undefined)`, which yields **NaN** math and typically **no** recency flags. In normal npm metadata, `time[version]` should exist for published versions.

- **Dist-tags vs explicit versions:** There is an in-code **TODO** to fully align behavior when the requested spec is a **dist-tag** (e.g. `latest`) versus an explicit semver; keep that in mind when testing edge cases.

### User-visible messages

Errors and warnings include the publisher **name and email** so humans can verify who npm attributes the release to. Teams with strict PII policies may want to account for that in logs or shared terminals.

---

## Related concepts

- **Age Marshall** (`docs/age.marshall.md`) reasons about **package** age and maintenance signals; the Author Marshall reasons about **publisher identity** and **version publish recency** for the resolved version.
- Together, they support npq’s goal of catching supply-chain signals **before** `npm install` proceeds.
