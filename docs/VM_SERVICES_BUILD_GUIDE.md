# VibeCode VM Services Build Guide

This guide documents how to build and run the VibeCode Services VM with Valkey, PostgreSQL, and OpenVSCode.

## Quick Start

```bash
# Run the GUI VM app
open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
```

The app will:
1. Create a 1GB sparse disk at `~/VibeCode VMs/VibeCodeServices VM.bundle/`
2. Boot the Linux kernel with our services initramfs
3. Display the serial console in a text view

## Architecture

- **Kernel**: Linux 5.15 arm64 (from Ubuntu 22.04)
- **Initramfs**: `azure/unified-services-glibc-fixed.cpio.gz`
- **Base**: BusyBox + glibc 2.35 (Ubuntu 22.04)
- **Services**:
  - Valkey 8.0 (Redis-compatible, port 6379)
  - PostgreSQL 14 (port 5432)
  - OpenVSCode Server (port 3000)

## Rebuilding the Initramfs

### Prerequisites

```bash
# macOS tools
brew install cpio zstd
```

### Step 1: Extract Current Initramfs

```bash
mkdir -p /tmp/initramfs-work
cd /tmp/initramfs-work
gunzip -c /path/to/azure/unified-services-glibc-fixed.cpio.gz | cpio -idmv
```

### Step 2: Update Components

#### Update glibc (Ubuntu 22.04 / glibc 2.35)

```bash
curl -sL -o libc6.deb "http://ports.ubuntu.com/pool/main/g/glibc/libc6_2.35-0ubuntu3.12_arm64.deb"
ar x libc6.deb && zstd -d data.tar.zst && tar -xf data.tar
cp -a lib/aarch64-linux-gnu/* /tmp/initramfs-work/lib/aarch64-linux-gnu/
```

#### Update PostgreSQL 14

```bash
curl -sL -o pg14.deb "http://ports.ubuntu.com/pool/main/p/postgresql-14/postgresql-14_14.20-0ubuntu0.22.04.1_arm64.deb"
ar x pg14.deb && zstd -d data.tar.zst && tar -xf data.tar
cp usr/lib/postgresql/14/bin/postgres /tmp/initramfs-work/usr/bin/
cp usr/lib/postgresql/14/bin/initdb /tmp/initramfs-work/usr/bin/
cp -a usr/lib/postgresql/14/lib/* /tmp/initramfs-work/usr/lib/postgresql/14/lib/
cp -a usr/share/postgresql/14/* /tmp/initramfs-work/usr/share/postgresql/14/
```

#### Update ICU Libraries (for PostgreSQL)

```bash
curl -sL -o libicu70.deb "http://ports.ubuntu.com/pool/main/i/icu/libicu70_70.1-2_arm64.deb"
ar x libicu70.deb && tar -xf data.tar.zst
cp -a usr/lib/aarch64-linux-gnu/libicu*.so.70* /tmp/initramfs-work/usr/lib/aarch64-linux-gnu/
```

### Step 3: Rebuild Initramfs

```bash
cd /tmp/initramfs-work
find . -print0 | cpio --null -ov --format=newc 2>/dev/null | gzip -9 > /path/to/azure/unified-services-glibc-fixed.cpio.gz
```

## Rebuilding the Swift App

### Prerequisites

```bash
# Xcode command line tools
xcode-select --install
```

### Build

```bash
cd azure/SwiftUI-Apps

# Compile
swiftc -o VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode \
    VibeCodeServicesVibeCode.swift \
    -framework Cocoa \
    -framework Virtualization

# Sign with entitlements
codesign --force --sign - \
    --entitlements VibeCodeServicesVibeCode.entitlements \
    VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode
```

### Entitlements Required

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
</dict>
</plist>
```

## Troubleshooting

### PostgreSQL Fails to Start

Check for missing libraries:
```bash
# In the VM console
/usr/bin/postgres --version
# If it shows "error while loading shared libraries", note the library name
```

Common missing libraries and their Ubuntu packages:
- `libldap-2.5.so.0` → `libldap-2.5-0_2.5.16+dfsg-0ubuntu0.22.04.2_arm64.deb`
- `libicui18n.so.70` → `libicu70_70.1-2_arm64.deb`
- `libsystemd.so.0` → `libsystemd0_249.11-0ubuntu3.12_arm64.deb`

### No Network

Check the init script has proper DHCP configuration:
```bash
# In the VM console
ip addr
cat /tmp/udhcpc.log
```

### Services Not Starting

Check service logs:
```bash
# In the VM console
cat /tmp/valkey.log
cat /tmp/postgres.log
cat /tmp/openvscode.log
```

## GitHub Releases

Releases are published to: https://github.com/ryanmaclean/vibecode-webgui/releases

To upload new artifacts:
```bash
gh release upload v0.1.0-vm-services azure/unified-services-glibc-fixed.cpio.gz --clobber
```

## License

- **Swift App**: MIT
- **Initramfs Components**:
  - BusyBox: GPL-2.0 (not distributed, built from source)
  - glibc: LGPL-2.1
  - PostgreSQL: PostgreSQL License (BSD-like)
  - Valkey: BSD-3-Clause
  - OpenVSCode: MIT

