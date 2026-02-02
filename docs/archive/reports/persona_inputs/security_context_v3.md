# Security Hardening Roadmap Highlights
- TODO(sec-hardening-kubectl): SHA256 added 2025-10-01; cosign validation still pending; deadline 2025-10-08.
- TODO(sec-hardening-helm): Checksum added 2025-10-01; provenance/cosign pending; deadline 2025-10-10.
- TODO(sec-hardening-kubectx/kubens): Release checksum gating live 2025-10-01; final verification due 2025-10-11.
- TODO(sec-hardening-supply-chain-docs): docs/SECURITY.md checklist not updated; deadline 2025-10-05.

# Dockerfile Observations
- Node.js installed via `curl https://deb.nodesource.com/setup_18.x | bash` (no checksum).
- Go tarball fetched via `wget` without checksum/signature verification.
- Optional KubeHound install pipes remote script without verification.

# Tasks to Clarify
- What cosign commands and keys will be used for kubectl/helm verification?
- How to document supply-chain procedure in docs/SECURITY.md?
