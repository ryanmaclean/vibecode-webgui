# Agent 5: Security Hardening

## Goal
Ensure App Store native quality with proper security, entitlements, and OS protection.

## Tasks
1. Review and update entitlements (com.apple.security.virtualization)
2. Add code signing configuration
3. Create notarization workflow
4. Add privacy manifest
5. Document sandboxing approach
6. Verify VM isolation (no host filesystem access without explicit sharing)

## Success Criteria
- Entitlements properly configured
- Code signing works
- Notarization passes
- Privacy manifest complete
- VM properly isolated

## Files
- `platforms/macos/vz-swift/entitlements.plist` (check/create)
- `platforms/macos/vz-swift/PrivacyInfo.xcprivacy` (create)

## Notes
- App Store requires notarization
- Privacy manifest required for App Store submission
- VM isolation is critical for security
