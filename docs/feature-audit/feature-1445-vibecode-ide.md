# Feature Audit 1445: vibecode-ide (50GB)

**Source Release:** VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
**Issue:** https://github.com/ryanmaclean/vibecode-webgui/issues/1445
**Status:** Partially confirmed (scripts/manifest present)

## Summary
Full IDE environment VM image.

## Evidence
- `scripts/setup-ide-vm.sh` references `vibecode-ide.img` and EFI NVRAM outputs.
- `scripts/vm-manifest.example.json` includes `vibecode-ide.img` entries.

## Notes / Missing Info
- Release note lists 50GB; actual image size/build output not verified here.

## Follow-ups
- [ ] Confirm VM image size in build artifacts and update docs if mismatch.
