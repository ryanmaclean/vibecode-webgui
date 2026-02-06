# VibeCode Studio (v5.1.0-beta)

> **🚨 Emergency Release (Feb 2026)** - The "Ruthless" Edition

VibeCode is the AI-native IDE and Agent Orchestrator.
**Current Backend:** Ubuntu 24.04 via `vfkit` (Fast, Stable).

## 🚀 Quick Start

### 1. Install Dependencies
```bash
brew install vfkit
pip install -r scripts/requirements.txt
```

### 2. Launch Backend (Ubuntu VM)
You can use the restored CLI tool:
```bash
bin/vibecode-vm start
```
Or run the script directly:
```bash
python3 scripts/launch_ubuntu_vm.py
```

### 3. Launch Studio
```bash
npm run tauri:dev
```

## 🛠️ CLI Tool
Manage the VM environment with the unified CLI:
```bash
bin/vibecode-vm status  # Check health via Ralph Loop
bin/vibecode-vm start   # Launch Ubuntu VM
bin/vibecode-vm stop    # Stop VM
```

## 🖥️ Menubar App
A native macOS status bar app is available to control the environment:
1. **Build:** `cd platforms/macos/VibeCodeMenubar && swift build -c release`
2. **Run:** `.build/release/VibeCodeMenubar`

## 🔄 Ralph Loop
System health is monitored by the Ralph Loop daemon:
```bash
python3 scripts/ralph_loop.py
```

## 📦 Legacy & Migration
- **Gas Town:** Use `python3 scripts/gt_shim.py` for legacy commands.
- **Remote:** Use `scripts/migrate_from_remote.sh` to pull from `mbp-m1`.

---
*Powered by OpenClaw*

## 🍎 Native macOS Virtualization

VibeCode supports **Apple Virtualization Framework** for native macOS VM performance:
- **Native Speed**: Direct hardware virtualization without Docker overhead
- **ASIF Support**: Apple Sparse Image Format on macOS 26+ (2-3x faster I/O)
- **Full VM Control**: Start, stop, suspend, resume operations
- **Linux GUI VMs**: Graphics support with VirtIO GPU

See [Apple Virtualization Framework Documentation](docs/features/APPLE_VIRTUALIZATION_FRAMEWORK.md) for details.

## 🐳 Docker Option (Lightweight)
If you prefer containers over a full VM:
```bash
docker compose up -d
```
This launches the OpenClaw Gateway on port `18789`.
