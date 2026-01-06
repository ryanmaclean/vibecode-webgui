# Quick Build Reference

**Last Updated**: October 25, 2025

## TL;DR - Build the App

```bash
# 1. Update dependencies
cd src-tauri && cargo update

# 2. Build release
cargo build --release

# 3. Package for macOS
cd .. && npx @tauri-apps/cli build

# App location:
# src-tauri/target/release/bundle/macos/VibeCode.app
```

## Verify Build

```bash
# Check binary
ls -lh src-tauri/target/release/vibecode

# Test app
open src-tauri/target/release/bundle/macos/VibeCode.app

# Verify running
ps aux | grep -i vibecode | grep -v grep
```

## Common Issues

### Issue: `unknown variant 'perUser'`
**Fix**: Already fixed in `src-tauri/tauri.conf.json`

### Issue: DMG creation fails
**Fix**: Use .app bundle directly (it works!)

### Issue: App won't open (macOS security)
**Fix**: Right-click → Open (first time only)

## Quick Stats

- **Binary Size**: 4.9 MB
- **Build Time**: ~2 minutes
- **Architecture**: aarch64 (Apple Silicon)

## Full Documentation

- `TAURI_BUILD_GUIDE.md` - Complete build guide
- `TAURI_BUILD_FIXES.md` - Issue resolution
- `BUILD_SUMMARY.md` - Executive summary
- `TAURI_BUILD_REPORT.txt` - Final report

## GitHub

- Issue #685: https://github.com/ryanmaclean/vibecode-webgui/issues/685
- Release: https://github.com/ryanmaclean/vibecode-webgui/releases

---

**Status**: ✅ MVP Complete - Ready for Testing
