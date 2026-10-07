# Author Marshall

## What it does and why it matters

The **Author Marshall** is a supply-chain check that runs while npq audits a package. It inspects **who** published the specific version you are installing, **how long** that identity was quiet on this package before this release, and **how recently** that version was published.

That matters because common risk patterns on npm include:

1. **Account takeover or maintainer change** — Someone new starts publishing versions of a package that used to belong to someone else. If their **first** release under that identity is **brand new**, you may want to pause before installing.
2. **Dormant maintainer** — The **same** publisher (see **Publisher identity** below) published this package before, then had a **long gap** with no releases attributed to them on this package, then published again. That pattern can align with neglected credentials or account reuse.
3. **Very fresh releases** — A tarball published **days ago** has had little time for community review, security tooling, or reputation to catch problems. That risk exists even for long-tenured maintainers.

Older approaches sometimes **mixed** “first publish ever” with “published yesterday,” which produced **noise** for healthy packages. The Author Marshall **separates** publisher history, **gaps between releases by the same publisher**, and **absolute age of the tarball**, with explicit day thresholds.

**Publisher identity:** Publishers are matched by `_npmUser.email`, except for [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) releases. npm attributes every trusted publishing release to the same `GitHub Actions <npm-oidc-no-reply@github.com>` identity, so those releases are matched by the package's trusted publisher configuration (`_npmUser.trustedPublisher.oidcConfigId`, with or without its `oidc:` prefix) instead. Moving a package to trusted publishing, or pointing it at a different trusted publisher configuration, therefore counts as a **new** publisher. Someone who takes over an account could set up trusted publishing from their own repository, so these releases are not exempt.

**Check order:** The marshall runs **new author → dormant maintainer → version recency**. The **first** thrown `Error` or `Warning` ends validation. So if two signals would both apply (for example, a dormant **Warning** and a recency **Error`), whichever runs **first** in that order is what you see unless the earlier check does not throw.

---

## The three checks (with examples)

### 1. New author (first publish for this user on this package)

**Intent:** Flag situations where the version you install is the **first** version ever published to this package by this publisher (see **Publisher identity** above), **and** that publish is **recent**.

**Rule (simplified):** If the installed version is that user’s first publish for the package **and** it was published **within the last 21 days**, npq throws an **Error** and blocks the install flow like other marshall errors.

**Example A — Quiet (not flagged):** Package `ncp`-style scenario: the **latest** version is still the **only** version, and it was published **years** ago. That is “first publish” in a historical sense, but it is **not** a hot takeover signal today, so **no error** from this check.

**Example B — Flagged:** A package had releases from `alice@…` for years; a new version appears from `bob@…` and it is Bob’s **first** version on that package, published **5 days** ago. That is the kind of “new publisher + very recent” combination this check targets.

**Example C — Not the focus of this check:** Bob’s first version was published **60 days** ago. The new-author branch does not fire the 21-day rule (though **dormant maintainer** or **version recency** may still apply).

---

### 2. Dormant maintainer (same publisher, long gap before a recent release)

**Intent:** Flag when the publisher had a **previous** release on **this package** under the **same** identity, then a **long calendar gap** before the **timestamp** of the version you install, **and** the version you install is **recent**.

**Why only recent versions:** Like the new-author check, this signal matters at release time. A version that has been public for longer than npq's 30-day version recency window has had time to be noticed and unpublished, while long-standing maintainers often release less than twice a year. The trade-off: installing a compromised version more than 30 days after its release does not raise the dormant alert.

**How the gap is measured:** Among all versions in `pakument.versions` with that publisher identity, take the **latest** `pakument.time[version]` that is **strictly before** `pakument.time[installedVersion]`. The gap is the difference in those two instants, expressed in **whole days** (same rounding style as elsewhere in this marshall). Other maintainers may publish in between; only versions with the **same publisher identity** count toward this maintainer’s last prior publish.

**Rules (strict boundaries):**

- Version published **more than 30 days** ago → this check does nothing.
- **No** prior publish by this identity before this version’s time → this check does nothing (first release by this identity on the package, or not enough `time` data).
- Gap **> 274 days** (~9 months, `Math.round(365.25 × 0.75)`) → **Error** (“more than 9 months dormant”).
- Else gap **> 183 days** (~6 months, `Math.round(365.25 / 2)`) → **Warning** (“more than 6 months dormant”).
- At **exactly** 183 or 274 days, the **stricter** tier does **not** apply (`>` not `≥`).

**Example G — Warning:** The version was published **20 days** ago, and the last release by `dev@…` on this package was **200 days** before it → **Warning** with the maintainer name, email, and gap in days.

**Example H — Error:** Same, with a gap of **300 days** → **Error** with the same details.

**Example J — Not flagged:** The version was published **two years** ago, a year after the maintainer’s previous release → no dormant alert, because the version is outside the 30-day window.

**Example I — Other maintainer in the middle:** `1.0.0` by Alice, `2.0.0` by Bob, `3.0.0` by Alice again. For `3.0.0`, Alice’s gap is from **`1.0.0`**, not from Bob’s release.

---

### 3. Version recency (how new is this tarball?)

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

### How the three checks fit together

| Lens | Question |
|------|----------|
| **New author check** | “Is this the publisher’s **first** version on this package **and** was that first publish **within 21 days**?” |
| **Dormant maintainer check** | “Was this version published within **30 days**, did the **same publisher** publish this package **before**, and was the gap before **this** release **> 6 months** (warning) or **> 9 months** (error)?” |
| **Version recency check** | “Was this **version** published within **7 / 30 / 45 days**?” |

They are **complementary**: one stresses **trust in a new publisher on this package**, another **inactivity then a new release by the same identity**, and the last stresses **maturity of the release** itself.

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
   Reads `pakument.versions[packageVersion]._npmUser`, and derives the publisher identity from its email or trusted publisher configuration.  
   - Missing user or email → **Error** (“Could not determine publishing user…”).  
   - Email must pass a **simple format regex** (see Colin’s “reasonable email regex” note in code); invalid → **Error**.

4. **Find “first version for this user”**  
   The code scans `pakument.versions` and keeps the **first** entry whose publisher identity matches the current publisher’s identity (iteration follows `Object.values` order).  
   - **Note:** Registry JSON does not guarantee that iteration order matches strict chronological publish order; the condition used in code is aligned with “first matching version record for this publisher identity in that traversal,” combined with `firstVersionForUser.version === packageVersion` for the strict “this install is that first record” case.

5. **New author check**  
   If there is no prior version for that publisher identity, **or** the first matching version **is** the installed version, then if `pakument.time[packageVersion]` exists, compute age in whole days. If **≤ 21 days**, throw the **new author** `Error`.

6. **Dormant maintainer check**  
   If the installed version was published **at most 30 days** ago and there is a **strictly earlier** `pakument.time[…]` for the **same publisher identity** on this package, compute the gap in whole days from that **latest** such prior instant to the installed version’s time. If gap **> 274** → `Error`; else if gap **> 183** → `Warning`. If `time[packageVersion]` is missing or invalid, this block is skipped.

7. **Version recency check**  
   Compute days since `pakument.time[packageVersion]` (same date string as above). If **≤ 45** days, apply **≤ 7** → `Error`, **≤ 30** → `Warning` (the 7-day branch runs first, so very fresh releases are errors, not warnings).

8. **Success**  
   If nothing threw, the marshall returns the version’s publish date string for downstream use.

### Prerequisites and edge behavior

- **`versionPublishedDateString`:** If it were missing, the new-author block is skipped when it depends on that field; the dormant block is skipped if the current version time cannot be parsed; the recency block still runs with `new Date(undefined)`, which yields **NaN** math and typically **no** recency flags. In normal npm metadata, `time[version]` should exist for published versions.

- **Dist-tags vs explicit versions:** There is an in-code **TODO** to fully align behavior when the requested spec is a **dist-tag** (e.g. `latest`) versus an explicit semver; keep that in mind when testing edge cases.

### User-visible messages

Errors and warnings include the publisher **name and email** (plus the trusted publisher configuration ID for new-author and dormant alerts on trusted publishing releases, and for dormant maintainer, the **gap in days**) so humans can verify who npm attributes the release to. Teams with strict PII policies may want to account for that in logs or shared terminals.

---

## Related concepts

- **Age Marshall** (`docs/age.marshall.md`) reasons about **package** age and maintenance signals; the Author Marshall reasons about **publisher identity**, **gaps between releases by the same publisher on that package**, and **version publish recency** for the resolved version.
- Together, they support npq’s goal of catching supply-chain signals **before** `npm install` proceeds.
