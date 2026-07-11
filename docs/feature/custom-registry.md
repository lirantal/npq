# Custom registries

NPQ supports authenticated npm-compatible registries, including Artifactory, for both package metadata and registry-backed security checks. It reads the same standard npm configuration used by the package manager, so registry routing, authentication, proxies, and TLS settings remain consistent between auditing and installation.

## Configure a default registry

Set the registry and host/path-scoped token in an npm configuration file such as a project or user `.npmrc`:

```ini
registry=https://artifactory.example.com/artifactory/api/npm/npm-virtual/
//artifactory.example.com/artifactory/api/npm/npm-virtual/:_authToken=${ARTIFACTORY_TOKEN}
```

NPQ also accepts the standard CLI option. The option is used for the audit and is forwarded to the selected package manager:

```sh
npq install internal-tool --registry=https://artifactory.example.com/artifactory/api/npm/npm-virtual/
```

## Configure a scoped registry

Map a package scope to its registry and scope authentication to that registry's host and path:

```ini
@company:registry=https://artifactory.example.com/artifactory/api/npm/company/
//artifactory.example.com/artifactory/api/npm/company/:_authToken=${ARTIFACTORY_TOKEN}
```

With this configuration, `@company/tool` is audited against the company registry even when the default registry points elsewhere.

Never commit registry tokens. Prefer environment-variable substitution or a user-level npm configuration file, and make authentication keys as specific as the registry host and path allow. NPQ does not include credentials in user-facing registry errors.

## Configuration precedence

NPQ follows npm's configuration precedence, from highest to lowest:

1. Command-line options such as `--registry`
2. `npm_config_*` environment variables
3. Project `.npmrc`
4. User `.npmrc`
5. Global npm configuration
6. The public npm registry default

A scoped registry such as `@company:registry` is selected for that scope independently of the unscoped default registry.

## TLS, proxies, and client certificates

Standard npm network settings are supported. For example, a private certificate authority can be configured with:

```ini
cafile=/absolute/path/to/company-ca.pem
strict-ssl=true
```

NPQ also preserves npm's `proxy`, `https-proxy`, and registry-scoped `certfile` and `keyfile` settings. Client certificate and authentication settings apply through npm's registry client only to matching registry hosts and paths.

## Checks that may not be evaluated

Some npm-compatible registries do not implement every public npm service. NPQ reports these cases as `NOT EVALUATED` rather than silently passing or treating them as package findings:

- `signatures` when the selected registry does not expose signing keys;
- `provenance` when signing keys or attestations are unavailable;
- `downloads` for packages assigned to a custom registry, because public npm download counts do not describe private registry usage.

Skipped checks do not trigger a warning/error prompt and do not fail audit-only mode. Any warnings or errors found by other checks retain their normal behavior.

An unavailable optional endpoint is recognized when it responds with HTTP 404, 405, or 501. Authentication failures, network failures, server errors, and malformed registry responses remain fatal because NPQ cannot safely complete the audit.

## No public-registry fallback

NPQ never falls back to `registry.npmjs.org` or the public npm downloads service for a package assigned to a custom registry. Package metadata, manifests, signing keys, and attestations stay within the selected registry context. This avoids both incorrect audit results and disclosure of private package names to public npm services.

