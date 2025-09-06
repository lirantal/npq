# Optional Security Features

npq includes advanced security features that require additional dependencies. These features can be optionally disabled to reduce the installation footprint.

## Disabling Advanced Security Features

You can disable specific security marshalls using environment variables:

### Disable Signature Verification
```bash
export MARSHALL_DISABLE_SIGNATURES=true
npq install express
```

### Disable Provenance Verification  
```bash
export MARSHALL_DISABLE_PROVENANCE=true
npq install express
```

### Disable Both Features
```bash
export MARSHALL_DISABLE_SIGNATURES=true
export MARSHALL_DISABLE_PROVENANCE=true
npq install express
```

## What Gets Disabled

When these features are disabled:

- **Signatures**: npq will not verify npm registry signatures for packages
- **Provenance**: npq will not verify package build provenance attestations



## Security Trade-offs

**Important**: Disabling these features reduces security verification. Only disable if:
- You understand the security implications
- You have alternative security measures in place
- You prioritize smaller installation footprint over advanced security features

The core npq functionality (vulnerability checking, typosquatting detection, etc.) remains enabled.

## Environment Variable Reference

| Variable | Effect |
|----------|--------|
| `MARSHALL_DISABLE_SIGNATURES` | Disables npm registry signature verification |
| `MARSHALL_DISABLE_PROVENANCE` | Disables package provenance attestation verification |

Set any of these variables to any non-empty value to disable the feature.