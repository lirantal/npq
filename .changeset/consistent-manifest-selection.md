---
'npq': patch
---

Resolve audited registry versions using npm's manifest selection rules so semver-shaped dist-tags and differing range preferences cannot hide version-specific findings. Stop auditing on unresolved versions or missing manifests instead of coercing a version or treating the check as successful.
