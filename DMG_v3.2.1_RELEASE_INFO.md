# VibeCode Unified v3.2.1 - Datadog Edition

**Release Date:** January 14, 2026
**DMG File:** VibeCode-Unified-v3.2.1-Datadog.dmg
**Size:** 253 MB
**SHA256:** 837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff

## What's New in v3.2.1

### Added
- **Datadog VSCode Extension v2.0.0** integrated into OpenVSCode
  - 19+ commands for code analysis and monitoring
  - Static Code Analysis (works offline)
  - Cloud integration with Datadog (requires authentication)
  - Sidebar panels for setup and configuration

### Technical Details
- Initramfs updated from 117 MB to 120 MB (+3 MB)
- Extension files: 27 files, 41 MB uncompressed
- Extension location: `/.openvscode-server/extensions/datadog.datadog-vscode-2.0.0/`
- Automatic loading at boot via modified init script

## Installation

1. Download VibeCode-Unified-v3.2.1-Datadog.dmg
2. Verify checksum (optional):
   ```bash
   shasum -a 256 VibeCode-Unified-v3.2.1-Datadog.dmg
   # Should match: 837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff
   ```
3. Mount the DMG
4. Drag UnifiedServicesVibeCodeApp to Applications folder
5. Launch from Applications or Launchpad

## Included Services

All services from v3.2.0 remain:
- **SSH** (port 22/2222) - Password: vibecode
- **Valkey/Redis** (port 6379) - Key-value store
- **PostgreSQL** (port 5432) - Database
- **OpenVSCode Server** (port 8080) - Web IDE with Datadog extension

## Accessing OpenVSCode

Open your browser to: http://localhost:8080

The Datadog extension will be available in the Extensions panel.

## Size Comparison

| Version | Size | Initramfs | Change |
|---------|------|-----------|--------|
| v3.2.0 | 133 MB | 117 MB | - |
| v3.2.1 | 253 MB | 120 MB | +120 MB DMG, +3 MB initramfs |

Note: The DMG size increased due to compression differences. The actual
initramfs only grew by 3 MB to accommodate the Datadog extension.

## Documentation

- [DATADOG_EXTENSION_ADDED_SUMMARY.md](DATADOG_EXTENSION_ADDED_SUMMARY.md) - Implementation details
- [QUICK_REFERENCE_DATADOG_EXTENSION.md](QUICK_REFERENCE_DATADOG_EXTENSION.md) - Quick reference
- [DATADOG_EXTENSION_FINAL_REPORT.txt](DATADOG_EXTENSION_FINAL_REPORT.txt) - Verification report

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.
