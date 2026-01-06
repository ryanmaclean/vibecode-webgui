# Code Signing Quick Reference

## Check Signing Status

```bash
# Quick check
codesign -v BasicVibeCode.app
codesign -v LiquidGlassVibeCode.app

# Detailed check with entitlements
codesign -dv --entitlements - BasicVibeCode.app
codesign -dv --entitlements - LiquidGlassVibeCode.app

# Strict verification
codesign --verify --deep --strict --verbose=2 BasicVibeCode.app
```

## Re-sign Apps

```bash
# Re-sign with entitlements
codesign --force --deep --sign - --entitlements entitlements.plist BasicVibeCode.app
codesign --force --deep --sign - --entitlements entitlements.plist LiquidGlassVibeCode.app
```

## Build Process

```bash
# 1. Compile executables (optional, if source changed)
./build-apps.sh

# 2. Create and sign .app bundles
./bundle-apps.sh
```

## Required Entitlements

All apps must have these 4 entitlements:
- ✓ com.apple.security.virtualization
- ✓ com.apple.security.hypervisor
- ✓ com.apple.security.network.client
- ✓ com.apple.security.network.server

Location: `entitlements.plist`

## Current Status

Both apps are properly signed with ad-hoc signatures:
- BasicVibeCode.app: ✓ Valid (4/4 entitlements)
- LiquidGlassVibeCode.app: ✓ Valid (4/4 entitlements)

## Test Commands

```bash
# Run tests (after signing)
./test-basicvibecode.sh
./test-vibecode-multivm.sh
./test-all-apps.sh
```
