# Feature Audit 1426: VM Discovery System - Automatic detection and management of VM images

## Source
- Release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
- Issue: #1426

## Summary
Audit status: **TBD**

This audit will confirm automatic VM discovery and management features.

## Plan
- Locate VM discovery logic (filesystem scan, registries, metadata).
- Verify supported image formats and locations.
- Update docs to reflect current behavior.
- Add/update tests once the discovery surface is confirmed.

## Missing Info / Questions
- Where is VM discovery configured in mainline?
- Are there default search paths or registries?

## Tests
- TODO: Add unit/integration coverage once entrypoints are confirmed.
