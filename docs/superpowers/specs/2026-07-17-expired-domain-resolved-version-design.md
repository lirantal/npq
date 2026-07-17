# Expired-Domain Requested-Version Resolution

## Goal

Make the expired-domain marshall inspect the maintainer metadata for the package version npq will install, rather than always inspecting the `latest` dist-tag.

## Scope

- Resolve `pkg.packageVersion` against the pakument already fetched for the package.
- Read maintainers only from `pakument.versions[resolvedVersion]`.
- Treat an unresolvable requested version or missing maintainers for that resolved version as `NotEvaluated`.
- Preserve the existing domain normalization, DNS classification, RDAP corroboration, warning semantics, and custom-registry behavior.
- Add regression tests for an exact older version, a semver range, and a non-`latest` dist-tag.
- Add a patch changeset describing the corrected evaluation target.

## Design

`ExpiredDomainsMarshall.validate(pkg)` already fetches the pakument. It will call the inherited `resolvePackageVersion(pkg.packageName, pkg.packageVersion, pakument)` helper with that same object, avoiding a second registry request. The marshall will select `pakument.versions[resolvedVersion]` only after resolution succeeds.

When resolution returns `null`, or when the selected version has no maintainer list, validation will throw `NotEvaluated`. This preserves the current conservative policy: no missing or ambiguous metadata is represented as a pass or as an account-takeover warning.

## Testing

Each regression fixture will deliberately give `latest` different maintainer data from the requested version. The tests will assert the DNS resolver receives only the requested version's normalized email domain. They will cover an exact version, `^1.0.0`, and a `next` dist-tag. Existing tests continue to cover DNS, RDAP, malformed metadata, and unavailable maintainer data.

## Non-goals

- Changing warning text to list maintainer names or email addresses.
- Changing the DNS or RDAP evidence model.
- Changing package-version resolution shared by other marshalls.
- Adding new network requests or dependencies.
