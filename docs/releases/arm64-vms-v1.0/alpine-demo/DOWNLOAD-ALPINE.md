# Download Alpine Linux ARM64

This guide shows how to download and verify the Alpine Linux ARM64 ISO for the demo VM.

---

## Quick Download

### One-Line Download

```bash
cd alpine-demo
curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

**Download size:** ~69MB
**Architecture:** aarch64 (ARM64)
**Version:** Alpine Linux 3.20.3 Virtual

---

## Official Download Sources

### Primary Mirror (Recommended)

```bash
curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

### Alternative Mirrors

**US West:**
```bash
curl -L https://mirror.leaseweb.com/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

**Europe:**
```bash
curl -L https://mirror.alpix.eu/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

**Asia (Singapore):**
```bash
curl -L https://mirror.xtom.com.sg/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

---

## Verify Download

### Check File Size

```bash
ls -lh alpine-arm64.iso
# Expected: ~69MB (72,351,744 bytes)
```

### Verify SHA256 Checksum

**Download checksum file:**
```bash
curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso.sha256 \
  -o alpine-arm64.iso.sha256
```

**Verify:**
```bash
# macOS
shasum -a 256 -c alpine-arm64.iso.sha256

# Linux
sha256sum -c alpine-arm64.iso.sha256
```

**Expected output:**
```
alpine-virt-3.20.3-aarch64.iso: OK
```

### Manual Checksum Verification

If automatic verification fails:

```bash
# Calculate checksum
shasum -a 256 alpine-arm64.iso

# Compare with official checksum
cat alpine-arm64.iso.sha256
```

**Official SHA256 (v3.20.3):**
```
[Checksum will be shown in downloaded .sha256 file]
```

---

## Alpine Linux Versions

### What is "virt"?

Alpine Linux offers multiple image types:

- **alpine-virt**: Optimized for virtual machines (recommended for this demo)
- **alpine-standard**: Standard installation with more drivers
- **alpine-extended**: Includes additional packages
- **alpine-netboot**: Network boot image

**We use alpine-virt** because:
- Optimized for QEMU/KVM
- Smaller download (69MB vs 200MB+)
- Faster boot times
- Includes only virtualization-necessary drivers

### Version Information

- **OS:** Alpine Linux
- **Version:** 3.20.3 (latest stable as of October 2025)
- **Architecture:** aarch64 (ARM64)
- **Type:** Virtual edition
- **Release Date:** 2025
- **Support:** Until Alpine 3.22 release (approx. 2 years)

---

## Alternative: Latest Version

To always get the latest Alpine version:

### Find Latest Release

Visit: https://alpinelinux.org/downloads/

Or check programmatically:
```bash
curl -s https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/aarch64/ | \
  grep -o 'alpine-virt-[0-9.]*-aarch64.iso' | \
  head -1
```

### Download Latest

```bash
# Get latest version number
LATEST_VERSION=$(curl -s https://alpinelinux.org/downloads/ | \
  grep -oP 'Alpine \K[0-9.]+' | head -1)

# Download latest virt ISO
curl -L https://dl-cdn.alpinelinux.org/alpine/v${LATEST_VERSION}/releases/aarch64/alpine-virt-${LATEST_VERSION}.0-aarch64.iso \
  -o alpine-arm64.iso
```

---

## Troubleshooting Downloads

### Slow Download Speed

Try a different mirror closer to your location:

```bash
# List all mirrors
curl -s https://mirrors.alpinelinux.org/ | grep -o 'http[s]*://[^"]*'

# Choose one and download
curl -L [MIRROR_URL]/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

### Download Interrupted

Resume with curl:
```bash
curl -C - -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

Or use wget:
```bash
wget -c https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -O alpine-arm64.iso
```

### Checksum Mismatch

If checksum doesn't match:
1. Delete the file: `rm alpine-arm64.iso`
2. Try a different mirror
3. Re-download: `curl -L [MIRROR_URL]`
4. Verify again

If still failing, the file may be corrupted during transmission. Try:
```bash
# Download with integrity checking
curl -L --retry 5 --retry-max-time 300 \
  https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso
```

---

## After Download

### Verify File Is Ready

```bash
# Check file exists and size
ls -lh alpine-arm64.iso

# Check file type
file alpine-arm64.iso
# Expected: "ISO 9660 CD-ROM filesystem data"
```

### Test Boot

```bash
./test-boot.sh
```

This will:
- Boot the VM for 30 seconds
- Verify UEFI loads
- Confirm kernel boots
- Exit automatically

### Launch Full VM

```bash
./launch-demo.sh
```

This will:
- Start the VM in console mode
- Boot to login prompt
- Allow interactive use
- Shutdown with `poweroff` command

---

## File Management

### Where to Store

Keep the ISO in the `alpine-demo` directory:
```
alpine-demo/
├── alpine-arm64.iso          ← Downloaded ISO
├── demo-disk.qcow2           ← Created automatically
├── launch-demo.sh
├── test-boot.sh
└── demo-vm.sh
```

### Disk Space

- **ISO file:** ~69MB
- **Demo disk:** ~200KB initially, grows as used (max 8GB)
- **Total:** ~70MB for basic setup

### Cleanup

To remove downloaded files:
```bash
# Remove ISO only (can re-download)
rm alpine-arm64.iso alpine-arm64.iso.sha256

# Remove everything (including VM disk)
rm alpine-arm64.iso* demo-disk.qcow2
```

---

## Advanced Options

### Create Local Mirror

If downloading multiple times:

```bash
# Create mirror directory
mkdir -p ~/alpine-mirror/v3.20/aarch64

# Download to mirror
curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o ~/alpine-mirror/v3.20/aarch64/alpine-virt-3.20.3-aarch64.iso

# Copy from mirror
cp ~/alpine-mirror/v3.20/aarch64/alpine-virt-3.20.3-aarch64.iso alpine-arm64.iso
```

### Download with Progress Bar

```bash
# Using curl with progress
curl -# -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -o alpine-arm64.iso

# Using wget with progress
wget --progress=bar:force \
  https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso \
  -O alpine-arm64.iso
```

### Verify GPG Signature

For maximum security:

```bash
# Download GPG signature
curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso.asc \
  -o alpine-arm64.iso.asc

# Import Alpine Linux signing key
curl -L https://alpinelinux.org/keys/alpine-devel@lists.alpinelinux.org.asc | gpg --import

# Verify signature
gpg --verify alpine-arm64.iso.asc alpine-arm64.iso
```

---

## What's Next?

After downloading:

1. **Verify the download:** `shasum -a 256 alpine-arm64.iso`
2. **Test boot:** `./test-boot.sh`
3. **Launch demo:** `./launch-demo.sh`
4. **Read the README:** `cat README.md`

---

## Official Resources

- **Website:** https://alpinelinux.org
- **Downloads:** https://alpinelinux.org/downloads/
- **Mirrors:** https://mirrors.alpinelinux.org/
- **Documentation:** https://wiki.alpinelinux.org
- **Security:** https://alpinelinux.org/security/

---

## Support

### Issues with Download

If you encounter problems:
1. Check internet connection
2. Try alternative mirror
3. Verify disk space: `df -h .`
4. Check DNS resolution: `nslookup dl-cdn.alpinelinux.org`

### Questions

- Alpine Linux issues: `#alpine-linux` on Libera.Chat
- VM setup issues: See main README.md troubleshooting section
- VibeCode issues: GitHub Issues

---

**Quick Start:**

```bash
cd alpine-demo
curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso -o alpine-arm64.iso
./launch-demo.sh
```

---

*Alpine Linux: A security-oriented, lightweight Linux distribution based on musl libc and busybox.*
