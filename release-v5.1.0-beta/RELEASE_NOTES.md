# VibeCode v5.1.0-beta (The "Ruthless" Edition)
**Release Date:** Feb 1, 2026

## 🚨 Emergency Release
This release pivots the backend to **Ubuntu + vfkit** for immediate stability and speed.

## 🔄 Ralph Loops & Polecats
- **Ralph Loop:** A new continuous validation daemon (`ralph_loop.py`) monitors system health.
- **Polecat Integration:** Automated refactors are now validated by Ralph Loops.

## 🏙️ Dual Gas Town Support
- **Local:** OpenClaw Gateway running in Ubuntu VM.
- **Remote:** `mbp-m1.local` supported via `gastown_topology.json`.
- **Legacy Shim:** `gt` command emulated via `gt_shim.py`.

## 📦 Installation
1. Run `python3 launch_ubuntu_vm.py` to start the backend.
2. Use `python3 gt_shim.py status` to check health.
