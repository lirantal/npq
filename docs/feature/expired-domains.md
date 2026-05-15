# Expired Domains Marshall

## What it does and why it matters

The **Expired Domains Marshall** checks maintainer email domains for the package version being audited. If a maintainer email uses a domain that no longer appears to exist in DNS, npq reports it as an account takeover risk.

This matters because npm account recovery and maintainer identity often rely on email addresses. If an attacker can register an expired maintainer email domain, they may be able to receive messages for that domain and attempt to recover or compromise accounts tied to package publishing.

## How findings are reported

The marshall reports all maintainers whose domains fail the expired-domain check in one error message:

```text
Detected expired domains that can be abused for account takeover: gloridea <gloridea@gloridea.net> uses gloridea.net
```

If multiple maintainers use expired domains, each maintainer/domain pair is included. If multiple maintainers share the same expired domain, npq performs one DNS check for that domain and maps the result back to every affected maintainer.

## Implementation overview

**Location:** `lib/marshalls/expiredDomains.marshall.js`  
**Category:** Package Health (`marshallCategories.PackageHealth`)

High-level flow:

1. Fetch the package document with `packageRepoUtils.getPackageInfo`.
2. Resolve the requested package version with `packageRepoUtils.getSemVer`, so tags and ranges are checked against the concrete version being installed.
3. Read `versions[resolvedVersion].maintainers`.
4. Extract and normalize each maintainer email domain.
5. Deduplicate domains before performing DNS lookups.
6. Check DNS evidence for each unique domain.
7. Report every maintainer/domain pair whose domain appears expired.

## DNS evidence

npq checks several DNS record types for each unique maintainer email domain:

- `NS`
- `MX`
- `SOA`

If any lookup returns records, npq treats the domain as existing and does not report it. If all lookups fail with non-existence style DNS responses, npq treats the domain as an expired-domain risk.

The CLI message intentionally avoids low-level DNS codes. The end user needs to know which maintainer email domain is risky; DNS transport details such as resolver timeouts are not useful as install-time security guidance.

## Limits and false positives

This check uses DNS as a practical signal, not as a complete domain registration proof. A domain can fail DNS lookups because it is expired, but also because of misconfiguration or resolver behavior. To reduce false positives, npq does not report indeterminate DNS failures, such as timeouts, as expired-domain findings.

The check does not currently perform registrar RDAP/WHOIS lookups. That could be added later if npq needs stronger confirmation that a domain is actually available for registration.

## Disabling the check

Use the marshall disable environment variable:

```bash
MARSHALL_DISABLE_MAINTAINERS_EXPIRED_EMAILS=1 npq install <package>
```

## Testing

The unit tests mock DNS resolution so they do not depend on live network state. Coverage includes:

- Reporting all expired-domain findings instead of only the first one.
- Deduplicating DNS lookups while still reporting all affected maintainers.
- Checking the resolved package version instead of always checking `latest`.
- Treating any successful DNS evidence as proof that the domain exists.
- Ignoring malformed or missing maintainer emails without crashing.
