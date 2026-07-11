# Custom Registry Support Design

## Context

[Issue #429](https://github.com/lirantal/npq/issues/429) reports that npq cannot run in
an environment where the public npm registry is blocked and package installation uses an
internal Artifactory npm registry. The package manager honors the user's `.npmrc`, but npq's
audit phase currently makes independent requests to hard-coded npmjs endpoints.

Registry access is split across `PackageRepoUtils`, the signature marshall, and the
provenance marshall. Although some helper constructors accept a registry URL, the CLI does
not load npm configuration or inject it into those helpers. The public npm downloads API is
also a separate, hard-coded service.

## Goals

- Honor standard npm-compatible configuration for default and scoped registries.
- Preserve npm's CLI, environment, project, user, and global configuration precedence.
- Support registry-scoped tokens, basic authentication, proxy settings, custom certificate
  authorities, client certificates, and strict TLS configuration.
- Route every package-registry audit request through the registry selected for that package.
- Never silently fall back to npmjs when a custom registry is configured.
- Distinguish an unavailable optional registry capability from a failed registry connection.
- Make unavailable optional checks visible without treating them as package findings.
- Keep default public-npm behavior compatible with current npq behavior.

## Non-goals

- Native Yarn `.yarnrc.yml` parsing.
- Artifactory administration APIs or registry-specific analytics integrations.
- Synthesizing public npm download counts for packages installed through a custom registry.
- Falling back to another registry when the configured registry is unavailable.
- Changing existing marshall severities when the data required by a marshall is available.

## Chosen Approach

npq will use a central npm-compatible registry context rather than extending its existing
`fetch` calls independently or delegating metadata lookups to package-manager subprocesses.

The implementation will use `@npmcli/config` to load and validate standard npm configuration
and `npm-registry-fetch` for registry selection, authentication, and transport. Versions will
be selected during implementation that support the repository's Node.js 24 runtime. npq will
not parse `.npmrc` authentication records itself and will not depend on a globally installed
npm module at runtime.

This approach centralizes security-sensitive configuration and prevents the metadata,
signature, and provenance code paths from resolving registries differently.

## Architecture

The dependency flow is:

```text
CLI entry point
  -> RegistryConfig
  -> RegistryClient
  -> Marshall
  -> PackageRepoUtils and registry-dependent marshalls
```

### `RegistryConfig`

`RegistryConfig` loads configuration once per npq process. It receives the current working
directory, environment, and supported registry-related CLI options. It exposes:

- the effective default registry;
- package-scope registry mappings;
- flattened request configuration for `npm-registry-fetch`;
- the source level of non-secret settings for diagnostics; and
- sanitized registry descriptions that never contain credentials.

It validates configuration before any audit request. Invalid authentication scoping,
unreadable referenced files, or invalid TLS configuration stops the audit.

npq supplies the npm configuration definitions and defaults that it consumes through its
runtime dependencies. It does not shell out to `npm config`, because subprocess output is not
a safe or complete transport for authentication and connection settings.

### `RegistryClient`

`RegistryClient` is the only component that performs npm-registry HTTP requests. For each
package, it derives the package scope and selects `@scope:registry` when configured, otherwise
the default `registry`.

It provides explicit operations for:

- package packuments;
- resolved-version manifests;
- registry signing keys;
- attestation bundles; and
- public npm download counts when applicable.

It normalizes registry URLs and applies the complete flattened request configuration to
`npm-registry-fetch`. It also owns per-registry capability state.

### `PackageRepoUtils`

`PackageRepoUtils` remains the higher-level metadata and semver helper. It delegates network
operations to `RegistryClient`. Package-information cache keys include the normalized registry
URL and package name, preventing data from a default registry and a scoped registry from
colliding.

### Marshall injection

Both `npq` and `npq-hero` initialize one registry context and pass it into `Marshall`.
`Marshall` passes the same client to `PackageRepoUtils` and all registry-dependent marshalls.
Signature and provenance marshalls no longer construct clients with hard-coded registry URLs.

Registry signing-key and capability caches are keyed by normalized registry URL. A process
using multiple scoped registries never reuses keys or capability decisions across registries.

## Configuration Semantics

The supported precedence is:

1. Supported npm-compatible CLI settings, including `--registry`, `--userconfig`, and
   `--globalconfig`.
2. `npm_config_*` environment variables.
3. Project `.npmrc`.
4. User `.npmrc`.
5. Global `.npmrc`.
6. npm-compatible defaults supplied by npq.

The CLI parser separates npq-owned flags from registry configuration and package-manager
arguments. `--registry` affects the audit and remains available to the eventual package-manager
command. npq does not add `NPQ_REGISTRY` or `--npq-registry`; there is only one registry
configuration surface.

Registry selection is package-specific. For example, `@company/tool` uses
`@company:registry` when present, while an unscoped package uses the default registry.
Credentials remain scoped by registry host and path according to npm rules. They are never
copied to a different origin.

`NPQ_PKG_MGR` continues to select the installation command only. The registry audit behavior
does not change based on whether npm, pnpm, or Yarn performs the installation. `.npmrc` is the
interoperability surface for this feature.

## Request Flow

For each package:

1. `RegistryConfig` resolves the effective registry from the package scope.
2. `RegistryClient` fetches the package packument using the selected registry and its scoped
   credentials and connection configuration.
3. `PackageRepoUtils` caches the packument by registry and package and supplies it to marshalls.
4. Marshalls that require a manifest, signing keys, or attestations request them through the
   same client and registry context.
5. Results are reported as findings, successful checks, or `notEvaluated` checks.

An attestation URL advertised by package metadata is not followed to a different origin.
The client retains the endpoint path and appends it to the selected registry base URL while
preserving any Artifactory repository path prefix. This keeps requests inside an Artifactory
proxy and prevents credential or package-name disclosure to a registry that the user did not
select.

## Capability Model

The marshall result model gains a non-failing `notEvaluated` collection alongside warnings,
errors, and data. Each entry identifies the package and gives a stable, concise reason.
`notEvaluated` entries:

- appear in plain and rich output;
- do not increment warning or error counts;
- do not trigger prompts or auto-continue;
- do not change the process exit status; and
- are grouped naturally by marshall to avoid repetitive output.

An optional registry service is considered unavailable when its endpoint returns `404`, `405`,
or `501`, or when a well-formed response explicitly indicates that the capability is absent.
Empty signing-key capability data is also unavailable. Invalid JSON or a response that violates
the expected protocol is a registry failure, not an unavailable capability.

Capability results are cached per registry URL. Known-unavailable endpoints are not probed once
per package.

### Signature and provenance behavior

If signing-key or attestation services are unavailable, the affected marshall reports
`notEvaluated`. Provenance regression logic is not run without the evidence required to verify
the target release.

When services are available, current package-level semantics remain unchanged. An unsigned
package, a package published without provenance, an invalid signature, or a provenance
regression continues to produce the same severity it produces today.

### Download behavior

The downloads marshall uses `api.npmjs.org` only when the selected registry is the normalized
public npm registry. For every custom registry, it reports `notEvaluated` without contacting the
public downloads API. Registry-specific download analytics are out of scope.

## Error Handling

The following failures stop the audit rather than becoming `notEvaluated`:

- authentication or authorization failures, including `401` and `403`;
- TLS, proxy, certificate, DNS, timeout, and connection failures;
- registry server failures;
- malformed or unusable core package metadata;
- malformed optional-service responses; and
- invalid npm configuration.

A package metadata `404` retains npq's existing package-not-found result. An optional endpoint
`404` is interpreted as an unavailable capability only after the core package lookup has
succeeded.

Errors shown to users include the sanitized registry origin and actionable failure category.
They never include authorization headers, tokens, passwords, raw certificate contents, or URLs
containing embedded credentials.

## Security and Privacy Invariants

- Auditing a package assigned to a custom registry causes zero package-registry or download
  requests to npmjs. Packages explicitly assigned to npmjs may still use npmjs in the same run.
- Authentication material is sent only to the matching registry host and path.
- Registry configuration and errors are redacted before logging or reporting.
- Scoped registries have isolated metadata, signing-key, and capability caches.
- No fallback registry is attempted after a network, authentication, or capability failure.
- Optional-service absence is visible and cannot be misreported as a successful security check.

These invariants apply to both `npq` and `npq-hero`.

## Compatibility

With no custom registry configuration, npq continues to use
`https://registry.npmjs.org/`, including the public npm download-count service. Existing
marshall-disable environment variables, finding severities, prompts, and default registry
behavior remain unchanged.

The change adds runtime dependencies and updates the lockfile, but does not change the minimum
Node.js or npm versions. Native Yarn configuration and non-npm registry protocols remain outside
the compatibility contract.

## Testing Strategy

Tests use mocked configuration files and HTTP responses; CI does not require a live Artifactory
instance or real credentials.

### Configuration tests

- CLI, environment, project, user, and global precedence.
- Default and multiple scoped registry selection.
- Environment expansion in `.npmrc`.
- Token and basic authentication scoping.
- Proxy, CA, client certificate, and strict-TLS propagation.
- Invalid auth scoping and unreadable configuration failures.

### Client tests

- Packument, manifest, key, attestation, and public-download endpoint construction.
- Scoped registry and credential selection per package.
- Cache isolation by registry and package.
- Attestation paths rebased to the selected registry.
- No npmjs request when a custom registry is selected.
- Capability caching and `notEvaluated` classification.
- Fatal classification for auth, TLS, network, protocol, and server errors.
- Redaction of every supported credential form from output and errors.

### Marshall and CLI tests

- Signature, provenance, and downloads behavior for supported and unsupported services.
- Existing public npm behavior and finding severities.
- `notEvaluated` rendering in plain and rich output.
- Warning/error counts, prompts, auto-continue, and exit status unaffected by skipped checks.
- End-to-end configuration and `--registry` forwarding for `npq` and `npq-hero`.

## Documentation and Release

Implementation will add a user-facing custom-registry document with examples for:

- a default Artifactory registry;
- a scoped internal registry;
- registry-scoped token authentication; and
- a custom certificate authority.

The README and documentation index will link to that guide and describe `notEvaluated` checks
and the no-fallback guarantee. The change requires a Changeset because it adds user-visible
package behavior.

## Acceptance Criteria

The feature is complete when:

1. A package available only through an authenticated Artifactory npm registry can be audited by
   both `npq` and `npq-hero` using standard `.npmrc` configuration.
2. Default and scoped registries resolve with standard npm precedence.
3. No npmjs package-registry or download request occurs for a package assigned to a custom
   registry.
4. Missing optional services appear as `notEvaluated` without affecting findings, prompts, or
   exit status.
5. Registry configuration, authentication, transport, and metadata failures stop the audit with
   redacted, actionable errors.
6. Existing default npmjs behavior and marshall severities remain covered and unchanged.
7. Tests, lint, documentation, and a Changeset satisfy the repository contribution rules.
