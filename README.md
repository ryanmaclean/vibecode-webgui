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
```bash
python3 scripts/launch_ubuntu_vm.py
```

### 3. Launch Studio
```bash
npm run tauri:dev
```

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

## 🐳 Docker Option (Lightweight)
If you prefer containers over a full VM:
```bash
docker compose up -d
```
This launches the OpenClaw Gateway on port `18789`.
