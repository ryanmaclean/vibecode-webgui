# Feature Audit 1424: Apple VF Runtime Support - Native Apple Virtualization Framework for running Linux VMs

## Source
- Release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
- Issue: #1424

## Summary
Audit status: **TBD**

This audit will confirm native Apple Virtualization Framework runtime support
for running Linux VMs.

## Plan
- Locate runtime boot/launch flow for AVF-backed VMs.
- Verify configuration options and supported kernels/images.
- Update docs to reflect runtime support.
- Add/update tests once runtime entrypoints are confirmed.

## Missing Info / Questions
- Where are runtime launch configs defined for AVF?
- Are there known limitations for Linux VM runtime support?

## Tests
- TODO: Add unit/integration coverage once entrypoints are confirmed.
