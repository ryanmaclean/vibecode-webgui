# Deployment Log: v5.1.0-beta

## Status: STAGED
**Date:** Feb 1, 2026
**Edition:** Ruthless (Ubuntu/vfkit)

## Actions Taken
1. **Version Bump:** All manifests updated to `5.1.0-beta`.
2. **Documentation:** README pivoted to Ubuntu backend instructions.
3. **Validation:** Ralph Loop daemon verified (`scripts/ralph_loop.py`).
4. **Legacy:** Gas Town shim verified (`scripts/gt_shim.py`).

## Execution Instructions
To publish this release to GitHub:

```bash
# 1. Install Python Deps
pip install -r scripts/requirements.txt

# 2. Publish Release
python3 scripts/release_manager.py
```

## Next Steps
- Boot the Ubuntu VM: `python3 scripts/launch_ubuntu_vm.py`
- Connect VibeCode: Open App -> Settings -> Gateway: `localhost:18789`

## ⚠️ Known Regressions (Tracked)
The "Ruthless" pivot to Ubuntu/vfkit temporarily dropped some features from v4.x/v3.x. These are now tracked as issues:
- [Issue #1129] Restore Native macOS Menubar App
- [Issue #1130] Restore `vibecode-vm` CLI Tool
- [Issue #1131] Restore 9p Persistent Storage
- [Issue #1132] Expose Docker Socket (Port 2375)
