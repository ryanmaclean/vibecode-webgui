---
title: Repository Hygiene
description: Keep large VM artifacts out of git; how to package and share binaries safely
---

# Repository Hygiene for VM Artifacts

Large VM-related binaries and screenshots should not be committed to git. This repo uses a minimal `.gitignore` policy to reduce noise and keep history small.

## Ignore these locally
- ipsw archives (`*.ipsw`, `ipsw-archive/`)
- VM disk images (`*.qcow2`, `*.dmg`, `vibecode-macos-vfkit.qcow2`)
- Temporary vfkit directories (`vfkit-*/`, `vfkit-boot/`), kernel/initrd blobs (`vmlinuz`, `initrd`)
- Host-specific identifiers (`hardware-model`, `machine-id`)
- Screenshots (`screenshot-*.png`, `screenshot-*.jpg`)

See `.gitignore` for the authoritative list.

## How to share artifacts
- Use GitHub Releases to publish versioned images or archives.
- Include a short `SHA256SUMS` file and a README with usage notes.
- Provide a script to download/verify artifacts (curl + checksum) instead of committing them.

## Reproducible environments
- Prefer scripts that build or fetch artifacts deterministically.
- Use snapshots/immutable bases for fast cloning without storing images in git.
