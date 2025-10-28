---
title: vfkit macOS Quickstart
description: Launch macOS VMs with vfkit reliably; install web editors and verify access
---

# vfkit macOS Quickstart

This guide shows a minimal, reliable way to boot an existing macOS VM with vfkit and set up web-based editors.

## Prerequisites
- Existing macOS VM artifacts (Disk.img, HardwareModel, AuxiliaryStorage base).
- vfkit installed on host.
- Optional: Bridged networking for direct host access; otherwise use host-only/port-forwarding.

## Per-VM aux + PID pattern (avoids aux lock)

```bash
mkdir -p vfkit-<name>
cp vfkit-boot/aux-copy.img vfkit-<name>/aux.img

vfkit \
  -cpu host \
  -memory 8192 \
  -disk path=/path/to/Disk.img,readonly=false \
  -aux-storage path=vfkit-<name>/aux.img \
  -pid-file vm-<name>.pid
```

Notes:
- Use a unique directory and PID file per VM instance.
- Stop the VM by sending SIGTERM to the PID in `vm-<name>.pid` or your preferred vm-manager script.

## Install editors inside the macOS VM

Install `code-server` (port 8080):

```bash
brew install code-server || curl -fsSL https://code-server.dev/install.sh | sh
code-server --auth password --bind-addr 0.0.0.0:8080 &
```

Install latest `openvscode-server` (port 8081):

```bash
curl -fsSL https://aka.ms/install-vscode-server/setup.sh | sh || true
OPENVSCODE_SERVER_ROOT="$HOME/.local/share/code-server" # adjust if needed
$OPENVSCODE_SERVER_ROOT/bin/openvscode-server --host 0.0.0.0 --port 8081 &
```

Tip: Persist editor config under the VM user home; for system service, wrap with a launch agent.

## Verify from host
- code-server: http://<vm-ip>:8080
- openvscode-server: http://<vm-ip>:8081

If using NAT/host-only without a direct IP, create an SSH tunnel or enable bridged networking.

## Troubleshooting
- Aux lock → ensure per-VM `aux.img` and unique PID.
- IPSW install issues (VZErrorDomain 10004) → use a known-good UniversalMac IPSW or reuse an existing Disk.img.
- Connectivity → check firewall, ensure VM network is reachable, or use a tunnel.
