# Getting Started - ARM64 VMs v1.0.0

**Quick start guide for using the ARM64 VMs release.**

---

## Step 1: Choose Your VM

### Alpine Linux (Recommended for First-Time Users)

**Best for:**
- Quick testing
- Learning ARM64 virtualization
- Development environments
- Fast iteration

**Boot time:** 10-15 seconds
**Download:** 69MB

```bash
cd alpine-demo
```

### OmniOS (For Production Deployment)

**Best for:**
- Production workloads
- Enterprise features (ZFS, DTrace, Zones)
- Multi-tenant environments
- Long-term deployments

**Boot time:** 15-20 seconds
**Download:** 348MB (compressed)

```bash
cd omnios-production
```

---

## Step 2: Download VM Image

### For Alpine Linux

1. Read download instructions:
   ```bash
   cat DOWNLOAD-ALPINE.md
   ```

2. Download ISO (one command):
   ```bash
   curl -L https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/aarch64/alpine-virt-3.20.3-aarch64.iso -o alpine-arm64.iso
   ```

3. Verify download:
   ```bash
   ls -lh alpine-arm64.iso
   # Should be ~69MB
   ```

### For OmniOS

1. Read setup guide:
   ```bash
   cat DOWNLOAD-OMNIOS.md
   ```

2. Download and setup (one command):
   ```bash
   curl -L https://us-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst -o omnios-arm64.raw.zst && \
   zstd -d omnios-arm64.raw.zst && \
   qemu-img convert -f raw -O qcow2 -p omnios-arm64.raw omnios-arm64.qcow2 && \
   rm omnios-arm64.raw
   ```

3. Verify setup:
   ```bash
   qemu-img info omnios-arm64.qcow2
   ```

---

## Step 3: Launch VM

### Alpine Linux

**Console mode (recommended):**
```bash
./launch-demo.sh
```

**GUI mode:**
```bash
./demo-vm.sh
```

**Quick test:**
```bash
./test-boot.sh
```

### OmniOS

```bash
./launch-omnios.sh
```

---

## Step 4: Use the VM

### Alpine Linux

**Login:**
- Username: `root`
- Password: (none, just press Enter)

**Try these commands:**
```bash
# Verify ARM64
uname -m
# Output: aarch64

# Check OS
cat /etc/os-release

# Install packages
apk update
apk add nodejs npm

# Exit
poweroff
```

### OmniOS

**Login:**
- Username: `root`
- Password: (check OmniOS documentation)

**Try these commands:**
```bash
# Verify ARM64
uname -m
# Output: aarch64

# Check OS
cat /etc/release

# List zones
zoneadm list -cv

# Check ZFS
zpool status

# Exit
shutdown -h now
```

---

## Troubleshooting

### QEMU Not Found

```bash
# Install QEMU
brew install qemu

# Verify installation
qemu-system-aarch64 --version
```

### UEFI Firmware Not Found

```bash
# Check firmware location
ls -l /opt/homebrew/share/qemu/edk2-aarch64-code.fd

# If missing, reinstall QEMU
brew reinstall qemu
```

### VM Won't Boot

1. Check you're on Apple Silicon:
   ```bash
   uname -m
   # Should output: arm64
   ```

2. Verify image downloaded:
   ```bash
   ls -lh alpine-arm64.iso  # or omnios-arm64.qcow2
   ```

3. Check error messages in terminal

---

## Next Steps

### After Alpine Demo Works

1. Try OmniOS for production features
2. Test deploying an application
3. Benchmark performance
4. Plan cloud deployment

### After OmniOS Works

1. Create LX zones
2. Deploy VibeCode application
3. Set up monitoring (DTrace)
4. Plan migration to cloud

---

## Need More Help?

- **Main README:** Complete documentation
- **Troubleshooting:** See README.md in each directory
- **GitHub Issues:** Report problems
- **Community:** Alpine and illumos IRC channels

---

**Ready to start?**

```bash
cd alpine-demo
cat DOWNLOAD-ALPINE.md
```
