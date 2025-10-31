# Reproducible Sandbox Test Binaries

This document pins the exact sources/versions used for the minimal sandbox tests (code-server in a VM via Lima). Use these to reproduce the same environment.

## Host tooling
- Lima
  - Version: limactl 1.2.1
  - Install: https://github.com/lima-vm/lima
  - Verify: `limactl --version`

## Guest OS image
- Ubuntu Noble ARM64 cloud image
  - URL: https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-arm64.img
  - Architecture: arm64 (aarch64)
  - Note: Pin to this URL for consistency. For checksum pinning, download and run `shasum -a 256` locally.

## VM template
- Lima config used: `scripts/lima/vibecode-cs.yaml`
  - Driver: `vz` (Apple Virtualization)
  - CPU/RAM: 4 CPUs, 4GiB
  - Disk: 30GiB
  - Port forward: host 127.0.0.1:8080 → guest 8080

## In-guest components
- code-server
  - Version: v4.105.1 (arm64 deb)
  - Installer: `curl -fsSL https://code-server.dev/install.sh | sh`
  - Direct URL (arm64 deb):
    - https://github.com/coder/code-server/releases/download/v4.105.1/code-server_4.105.1_arm64.deb
  - Config (password auth):
    - File: `~/.config/code-server/config.yaml`
    - Contents:
      - `bind-addr: 0.0.0.0:8080`
      - `auth: password`
      - `password: vibecode`
  - Start (user-level): `nohup code-server >/tmp/code-server.log 2>&1 &`
  - Verify (inside VM): `ss -tlnp | grep 8080` (should show node listening)
  - Verify (host): `curl -I http://127.0.0.1:8080`

- nerdctl (pulled automatically by Lima)
  - Version: 2.1.3 (arm64)
  - Archive: https://github.com/containerd/nerdctl/releases/download/v2.1.3/nerdctl-full-2.1.3-linux-arm64.tar.gz
  - Digest observed: `sha256:544fa1e518155fcc01a117ea49819d12d96b4dacfb2b62922f9f7956dc9f6dc8`

## Browser compatibility note
- Use a Chromium-based browser for code-server access.
- WebKit/Safari and Tauri are not compatible with code-server (track separately as a desktop distribution).

## Minimal reproduce steps (summary)
1) Start VM: `limactl start -y scripts/lima/vibecode-cs.yaml`
2) Inside VM, install code-server: `curl -fsSL https://code-server.dev/install.sh | sh`
3) Configure password auth, then start: `nohup code-server >/tmp/code-server.log 2>&1 &`
4) Access: http://127.0.0.1:8080 (password: vibecode)

## Optional verification
- OS: `cat /etc/os-release | head -n 2`
- Kernel/arch: `uname -a`
- code-server: `code-server --version`

## Cleanup (reclaim space)
- Remove VM: `limactl stop vibecode-cs && limactl delete -f vibecode-cs`
- Remove vfkit demo assets: `rm -rf ~/.vfkit`
- Prune Lima cache: `limactl prune -y && rm -rf ~/Library/Caches/lima/download/by-url-sha256/*`
