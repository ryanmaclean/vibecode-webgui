# Code-Server v1.1.1 Build Status

**Date**: 2025-10-01
**Status**: In Progress

## Build Information

**Version**: 1.1.1 (GPL-free)
**Profiles**: minimal, standard, ai, web, full
**Architectures**: linux/amd64, linux/arm64
**Registries**: GHCR + Docker Hub

## Changes from v1.1.0

- Removed GNU Emacs (GPL license)
- Fixed cosign checksum verification
- Fixed Node.js installation (checksum verification)
- Fixed Go installation (checksum verification)
- Updated all documentation

## Build Runs

- minimal: Run 18180521078
- standard: Run 18180535495
- ai: Run 18180535812
- web: Run 18180536358
- full: Run 18180536946

Monitor: https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/codeserver-profiles.yml

## Verification

Once builds complete:
1. Check images exist in both registries
2. Verify no Emacs in any profile
3. Test standard profile end-to-end
4. Update CHANGELOG
5. Deprecate v1.1.0 tags

## Issues

- #453: Verify builds
- #454: Deprecate v1.1.0
- #455: Security hardening
- #456: Update documentation
- #457: Complete security audit
