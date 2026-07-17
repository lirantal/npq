# Expired-domain marshall

## Overview

The expired-domain marshall looks for a narrow account-recovery risk: a package maintainer email whose simple public domain no longer resolves and has no active registration in authoritative RDAP data. It is a warning-only signal. It does not claim that a domain is purchasable or that a package account can be taken over.

Maintainer email hosts are converted to ASCII, lowercased, and checked as complete hostnames. Only simple two-label domains, such as `example.com`, are eligible for a warning. Their top-level domain must also resolve publicly before RDAP is queried. Multipart names, such as `example.co.uk` or `mail.example.com`, are not collapsed to a guessed registration boundary; a failed lookup is reported as not evaluated. IP literals, special-use domains, single-label names, known internal names, and unparseable inputs are not queried.

## Evidence levels

| Evidence | Result |
| --- | --- |
| Public DNS resolves | Pass; RDAP is not queried |
| A multipart domain returns NXDOMAIN | Not evaluated; RDAP is not queried |
| A simple domain returns NXDOMAIN but its top-level domain cannot be verified | Not evaluated; RDAP is not queried |
| A simple domain returns NXDOMAIN, its top-level domain resolves, and RDAP returns a registered domain object | Pass; the DNS-only warning is suppressed |
| A simple domain returns NXDOMAIN, its top-level domain resolves, and the authoritative RDAP service returns 404 | Warning that no active registration was found and account takeover may be possible |
| DNS is inconclusive, RDAP cannot be routed, times out, rate-limits, or returns invalid data | Not evaluated |

A warning remains non-blocking. RDAP absence is not proof of current purchasability, registry policy can prevent registration, and npm account two-factor authentication status is not known to this check.

## Warning attribution

When DNS and RDAP corroborate an expired-domain warning, NPQ lists the affected maintainers grouped beneath each domain. The local warning includes the registry name and email when a name is available, or the email alone when it is not. This makes the finding traceable during a security review.

## External requests and privacy

The marshall sends normalized host or domain names only, never full maintainer email addresses.

1. Public DNS NS queries for complete maintainer email hosts go to the configured public resolvers.
2. After NXDOMAIN on a simple two-label domain, NPQ verifies its top-level domain through public DNS.
3. NPQ fetches the official IANA DNS RDAP bootstrap registry at `https://data.iana.org/rdap/dns.json`.
4. NPQ sends the two-label domain to the HTTPS RDAP service selected by that bootstrap data.

Registry credentials and npm authentication headers are never forwarded. RDAP requests use HTTPS-only bootstrap targets, reject redirects, and have a three-second timeout per request. Bootstrap and per-domain promises are cached for the lifetime of the process to reduce repeated disclosure and load.

## Limitations

The conservative two-label rule deliberately leaves multipart domains unevaluated when DNS fails. DNS and registration data can be stale or temporarily unavailable. Some registries do not publish usable RDAP service data. A 404 describes the authoritative RDAP response at query time; it does not guarantee that a registration attempt would succeed. The signal also cannot determine whether the maintainer email is an npm account recovery address or whether npm 2FA would prevent takeover.

## Disabling the check

Set the existing `MARSHALL_DISABLE_MAINTAINERS_EXPIRED_EMAILS` environment variable to disable the marshall. No additional RDAP-specific configuration is required.
