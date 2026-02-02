# Security Hardening Snapshot
- kubectl SHA256 checks added 2025-10-01; cosign verification pending (deadline 2025-10-08).
- helm checksum gating added 2025-10-01; provenance/cosign pending (deadline 2025-10-10).
- kubectx/kubens release checksum gating live 2025-10-01; final verification due 2025-10-11.
- docs/SECURITY.md supply-chain checklist still missing; due 2025-10-05.

# Dockerfile Risks
- Node setup uses `curl ... | bash` without checksum/signature.
- Go tarball downloaded via wget with no validation.
- Optional KubeHound install shells remote script unchecked.

# Questions
- What cosign commands/keys will verify kubectl/helm artifacts?
- How to enforce checksum/signature for Node/Go/KubeHound downloads?
- What documentation updates ensure auditors can reproduce checks?
