# Feature Audit 1446: UEFI Boot Support (VZEFIBootLoader)

**Source Release:** VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
**Issue:** https://github.com/ryanmaclean/vibecode-webgui/issues/1446
**Status:** Confirmed in repo (AVF bootloader code + tests)

## Summary
UEFI boot via `VZEFIBootLoader`.

## Evidence
- `platforms/macos/VibeCodeSwift/Sources/VM/EFIVariableStore.swift` constructs `VZEFIBootLoader`.
- `platforms/macos/VibeCodeSwift/Tests/VZConfigurationTests.swift` covers `VZEFIBootLoader` availability.

## Notes / Missing Info
- Confirm which VM flavors require EFI vs Linux bootloader.

## Follow-ups
- [ ] Document when EFI is selected in runtime configuration.
