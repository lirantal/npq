---
'npq': patch
---

Reject Git, tarball, local file/directory, and npm alias specifiers across npq, npq-hero install commands, and package.json dependencies before auditing or installing any package. Registry names, versions, ranges, and tags remain supported. Previously accepted unsupported sources must be audited separately and installed directly with the package manager.
