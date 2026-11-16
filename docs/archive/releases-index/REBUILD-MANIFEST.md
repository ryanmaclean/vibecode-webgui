# Release Rebuild Manifest
# Generated: 2026-02-08 Wave 22

## Summary
- 43 total releases on GitHub
- 16 releases have binary assets (53 total assets)
- 27 releases have 0 assets (code-only milestones or unrebuildable)
- Wave 22 rebuilt: Alpine kernels, initramfs variants, CLI binaries, source tarballs

## Releases WITH Assets (16 releases, 53 assets)

### Never Deleted (Original assets intact)
| Release | Assets | Total Size | Status |
|---------|--------|-----------|--------|
| v0.3.0-appstore | 3 (kernel, initramfs, disk) | 50MB | ORIGINAL |
| v3.0.0-unified-app | 13 (6 DMGs + checksums + notes) | 676MB | ORIGINAL |
| v4.2.0 | 7 (2 DMGs + tarballs + checksums) | 299MB | ORIGINAL |

### Rebuilt in Wave 22
| Release | Assets | What Was Rebuilt | Status |
|---------|--------|-----------------|--------|
| v1.0.0-initramfs | 9 | Alpine 3.19+3.22 kernels+initramfs, boot-minimal.cpio.gz, 2 built initramfs, source tarball, checksums | REBUILT |
| v1.0-kernel-k3s | 2 | Alpine 3.19 vmlinuz-virt + initramfs-virt ARM64 | REBUILT |
| v1.0-kernel-nodejs | 2 | Alpine 3.19 vmlinuz-virt + initramfs-virt ARM64 | REBUILT |
| v1.0-kernel-unified-glibc | 2 | Alpine 3.19 vmlinuz-virt + initramfs-virt ARM64 | REBUILT |
| v1.0-kernel-unified-postgres | 2 | Alpine 3.19 vmlinuz-virt + initramfs-virt ARM64 | REBUILT |
| v1.0.0-basicvibecode | 6 | 4 CLI binaries (darwin/linux × arm64/amd64) + source tarball + checksums | REBUILT |
| v1.0.0 | 1 | Source tarball | REBUILT |
| v0.1.0-vm-services | 1 | Source tarball | REBUILT |
| v1.0-app-vsock | 1 | Source tarball | REBUILT |
| v1.0-app-valkey | 1 | Source tarball | REBUILT |

### Rebuilt Asset Details

**v1.0.0-initramfs (9 assets):**
- alpine-3.19-vmlinuz-virt-arm64 (8.2MB) - Alpine 3.19 virt kernel
- alpine-3.19-initramfs-virt-arm64 (7.6MB) - Alpine 3.19 stock initramfs
- alpine-3.22-vmlinuz-virt-arm64 (9.1MB) - Alpine 3.22 virt kernel (latest)
- alpine-3.22-initramfs-virt-arm64 (8.5MB) - Alpine 3.22 stock initramfs (latest)
- boot-minimal.cpio.gz (1.8MB) - Original VibeCode boot initramfs (copied from v0.3.0-appstore)
- initramfs-minimal-arm64.cpio.gz (645KB) - BusyBox minimal initramfs (freshly built)
- initramfs-asif-test.cpio.gz (645KB) - ASIF test initramfs (freshly built)
- SHA256SUMS - Checksums for all files
- vibecode-v1.0.0-initramfs-source.tar.gz (470MB) - Source at tag

**v1.0.0-basicvibecode (6 assets):**
- vibecode-darwin-arm64 (11.7MB) - macOS Apple Silicon CLI
- vibecode-darwin-amd64 (12.3MB) - macOS Intel CLI
- vibecode-linux-arm64 (11.4MB) - Linux ARM64 CLI
- vibecode-linux-amd64 (12.1MB) - Linux x86_64 CLI
- SHA256SUMS-cli-release.txt - CLI checksums
- vibecode-v1.0.0-basicvibecode-source.tar.gz (470MB) - Source at tag

## Releases WITHOUT Assets (27 releases)

### Code-Only Milestone Releases (never had binary assets)
These are version tags marking code milestones - no binary assets were ever attached:
- v1.5.1-test-baseline
- v1.6.0-tests-100-percent
- v1.7.0-wave-2-complete
- v1.8.0-tests-100-percent
- v2.0.0-phase1-complete
- v3.1.1
- v3.2.0
- v3.2.1
- v3.3.0
- v4.0.0
- v4.0.1
- v4.1.0
- v0.2.0-vm-static
- 1.2.0-4

### Originally Had Assets (permanently lost)
These releases originally had binary assets that were permanently lost when deleted in Wave 21:
- **v1.5.0** - Had DMGs (Apple VF desktop app builds)
- **v1.6.0-multivm** - Had multi-VM manager images
- **v1.0.0-observability** - Had monitoring/telemetry binaries
- **v1.1.0** - Had DMGs + VM assets (vfkit integration)
- **v1.2.0** - Had Electron & Tauri builds
- **v1.3.0-ard** - Had ARD deployment package (.pkg)
- **v1.3.1-lima-kiosk** - Had Lima kiosk launcher
- **v1.4a-electron** - Had Electron build
- **minivim-20251002** - Had MiniVim x86_64 images
- **minivim-refresh-20251030** - Had MiniVim ARM64 images
- **fast-openvscode-vm-v0.1.0** - Had Fast OpenVSCode VM image
- **cloud-hypervisor-v1.0.0-alpha** - Had Cloud Hypervisor binary
- **v1.0.0-apple-container** - Had Apple Container artifacts
- **test-macos-universal-20251025-021238** - Had test universal app build
- **v5.1.0-beta** - May have had assets
- **v0.9-beta** - May have had assets

## What Was Permanently Lost

### Cannot Rebuild (need original build environment/signing)
- **Signed DMGs**: v1.5.0, v1.1.0, v1.2.0, v1.4a-electron (need Apple Developer signing certs)
- **ARD Package**: v1.3.0-ard (need pkgbuild + signing)
- **Electron builds**: v1.2.0, v1.4a-electron (need Electron + signing)
- **MiniVim images**: minivim-20251002, minivim-refresh-20251030 (need Docker + specific build env)
- **Cloud Hypervisor**: cloud-hypervisor-v1.0.0-alpha (need Rust + CH source at specific version)
- **Apple Container**: v1.0.0-apple-container (need Apple Container runtime)
- **VM disk images**: Various releases had disk.img.gz files

### Can Rebuild Later (build scripts exist)
- **Full-service initramfs** (PostgreSQL + OpenVSCode + Docker): needs Docker for Linux-native cpio build
  - Script: `scripts/Dockerfile.initramfs-builder` + `scripts/build-initramfs.sh`
- **K3s initramfs**: needs K3s + Helm downloads
  - Script: `scripts/build-k3s-initramfs.sh`
- **Tauri DMGs**: needs Tauri build environment
  - Script: Tauri build config in `platforms/tauri/`
- **Lima kiosk**: needs Lima config
  - Script: `scripts/lima/vibecode-cs.yaml`

## How to Rebuild Additional Assets

### Initramfs (Docker required)
```bash
docker build -t initramfs-builder -f scripts/Dockerfile.initramfs-builder scripts/
docker run -v /path/to/rootfs:/build/source -v /path/to/output:/build/output initramfs-builder
```

### K3s Initramfs
```bash
./scripts/build-k3s-initramfs.sh
```

### CLI Binaries (any version)
```bash
git checkout <tag>
make cli-all
# Binaries in bin/vibecode-{darwin,linux}-{arm64,amd64}
```

### Source Tarballs (any tag)
```bash
git archive <tag> --prefix=vibecode-<tag>/ | gzip > vibecode-<tag>-source.tar.gz
```
