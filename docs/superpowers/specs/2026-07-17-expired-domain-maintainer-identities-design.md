# Expired-domain maintainer identity warning design

## Goal

Make a corroborated expired-domain warning attributable by listing the package
maintainer records that use each affected email domain. This supports the NPQ
security-audit and provenance use case without changing the evidence threshold
for a warning.

## Scope

The expired-domain marshall will retain the normalized maintainer records for
each normalized email domain while it evaluates DNS and RDAP evidence. When a
domain is corroborated as unregistered, the warning will keep its existing
summary sentence and append an `Affected maintainers:` section. Each affected
domain is listed in lexical order, followed by the maintainer identities in
their registry order as `name <email>`.

For example:

```text
Maintainer domain example.com does not resolve in public DNS, and RDAP found no active registration; account takeover may be possible.

Affected maintainers:
- example.com: Alice Smith <alice@example.com>, Bob Jones <bob@example.com>
```

A maintainer with a non-empty name is rendered as `name <email>`; a maintainer
without a usable name is rendered as `email` alone. Invalid email records remain
excluded from the identity list and continue to be counted as incomplete records
under the current policy.

## Non-goals

- Do not change package-version resolution, DNS classification, public-TLD
  validation, RDAP lookup, or warning eligibility.
- Do not disclose maintainer identities to DNS or RDAP services; external
  requests continue to use normalized domains only.
- Do not add CLI configuration, debug-only output, or a new warning class.

## Data flow

1. Validate each maintainer email using the existing normalizer.
2. Store each valid original maintainer record under its normalized domain while
   preserving the existing per-domain count for incomplete-record reporting.
3. Run the existing deduplicated DNS, public-TLD, and RDAP pipeline against
   normalized domains.
4. When RDAP corroborates a domain, format the associated identities into the
   warning after the established summary sentence.
5. Keep the existing incomplete-record suffix unchanged.

## Testing

Add regression tests that prove a warning includes identities for multiple
maintainers sharing one corroborated domain, groups identities by multiple
domains in deterministic domain order, preserves their original maintainer
order within a group, and leaves the incomplete-record suffix intact. Existing
DNS/RDAP and version-resolution tests remain the safety net for unchanged
policy.
