# Package provenance in npq

This document describes how npq verifies npm **provenance** (build attestations) and why **provenance regression detection** matters for supply-chain security.

## What is npm provenance?

When a package is published with **provenance**, npm records **Sigstore** attestations that link the published tarball to a trusted build and source (for example, a GitHub Actions workflow via [trusted publishing](https://docs.npmjs.com/generating-provenance-statements)). The registry exposes this under each version’s `dist.attestations` metadata and serves attestation bundles for verification.

npq’s provenance marshall downloads the registry’s signing keys, fetches the package manifest for the **resolved** version (including semver ranges and dist-tags), and verifies those attestations with the same cryptographic checks npm relies on.

## Why provenance regression is a high-signal alert

A **provenance regression** means: an **older published semver** of the package **did** include provenance metadata on the registry, but the **version you are installing** does **not** (or it could not be cryptographically verified).

That pattern is unusual for maintainers who routinely publish from CI with provenance enabled. It can indicate, among other things:

- A release published **outside** the usual trusted pipeline (for example, via an npm token from a compromised maintainer account rather than OIDC trusted publishing).
- A deliberate or accidental change in how releases are produced.

Real-world motivation for this check is discussed in [npq issue #314](https://github.com/lirantal/npq/issues/314), including references to incidents such as malicious **@rspack/core** versions.

### Example: `pino`

As of the registry metadata used when this feature was implemented:

- **pino@9.13.1** includes `dist.attestations` (provenance metadata on the packument).
- **pino@9.14.0** does not include `dist.attestations` for that release.

Installing **pino@9.14.0** with the provenance marshall enabled therefore triggers a **provenance regression** error (not merely a warning), because a **newer** line release lacks provenance while a **prior** semver still shows provenance on the registry.

You can confirm the shape of the public packument with:

```bash
curl -sS -H 'accept: application/json' 'https://registry.npmjs.org/pino' | node -e "
const j = JSON.parse(require('fs').readFileSync(0, 'utf8'));
for (const v of ['9.13.1', '9.14.0']) {
  const a = j.versions[v]?.dist?.attestations;
  console.log(v, a ? 'has dist.attestations' : 'no dist.attestations');
}
"
```

## How npq implements regression detection (packument only, no extra requests per older version)

Older prototypes looped over prior releases with **one HTTP request per version** (for example via `pacote.manifest` each time), which was too slow and expensive. The current approach does **not** do that.

1. **Reuse the packument** already returned by `getPackageInfo` (same JSON document used for version resolution). No additional registry calls are made **only** for the regression check.
2. **Which prior versions are considered?** Every **valid semver** listed under `versions` that is **strictly older** than the resolved install version (`semver.lt`). There is **no** “only check the last N releases” cap: npq sorts those versions **newest-first** (`semver.rcompare`) and walks them **in order** until it finds the **first** entry whose `dist.attestations` is present. That version is the **representative prior** used in the error message. If **none** of the older entries have `dist.attestations` in the packument, the regression path does not apply (you get the usual warning-only behavior when the target lacks provenance).
3. If such a prior exists and the **target** version fails provenance verification (missing attestations, or verification errors that indicate the release did not verify as expected), npq throws a normal **`Error`** with a **“Provenance regression detected”** message.

The walk in step 2 is **in memory** over `packageInfo.versions` (cost scales with how many versions the package has published, not with extra round-trips per version).

Infrastructure failures (for example, failing to fetch the packument or registry keys) still surface as **warnings** or other errors without treating them as a regression.

**Caveat:** Regression uses **`dist.attestations` on the packument** for older releases. If the registry ever omitted that field on older `versions` entries while provenance still existed, npq would not detect a prior; a bounded manifest fallback could be added later if that proves necessary.

## Errors vs warnings in the CLI

- **Provenance regression** and other hard failures that use **`Error`** contribute to **error** counts. In `npq install`, that typically means you are prompted to continue with **default “no”**.
- Packages that **never** had provenance metadata on older versions still produce a **warning** when the target has no verifiable attestations (so benign packages are not escalated to the same severity).

Malformed Sigstore checkpoints that npm acknowledges as false positives are still handled per [issue #329](https://github.com/lirantal/npq/issues/329).

## Disabling provenance checks

Set:

```bash
export MARSHALL_DISABLE_PROVENANCE=true
```

This disables **all** provenance verification for that run, including regression detection.

## Related code

- [`lib/marshalls/provenance.marshall.js`](../../lib/marshalls/provenance.marshall.js) — resolution, verification, regression logic.
- [`lib/helpers/npmRegistry.js`](../../lib/helpers/npmRegistry.js) — manifest fetch and `verifyAttestations`.
