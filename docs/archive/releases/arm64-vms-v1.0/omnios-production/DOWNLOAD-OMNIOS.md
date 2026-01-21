# Download OmniOS ARM64

This guide shows how to download, extract, and convert the OmniOS ARM64 image for production use.

---

## Quick Download

### One-Line Download and Setup

```bash
cd omnios-production
curl -L https://us-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst \
  -o omnios-arm64.raw.zst && \
zstd -d omnios-arm64.raw.zst && \
qemu-img convert -f raw -O qcow2 -p omnios-arm64.raw omnios-arm64.qcow2 && \
rm omnios-arm64.raw
```

**Download size:** ~348MB (compressed)
**Final size:** ~683MB (qcow2), 58GB virtual
**Time:** ~5-10 minutes depending on connection

---

## Step-by-Step Instructions

### Step 1: Download Compressed Image

```bash
cd omnios-production

# Download OmniOS Braich (ARM64 port) release 151055
curl -L https://us-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst \
  -o omnios-arm64.raw.zst
```

**File details:**
- **Size:** ~348MB compressed
- **Format:** zstd compressed raw disk image
- **Release:** OmniOS r151055 Braich (ARM64 port)
- **Source:** Official OmniOS mirror

### Step 2: Verify Download

```bash
# Check file size
ls -lh omnios-arm64.raw.zst
# Expected: ~348-365MB

# Verify it's a zstd archive
file omnios-arm64.raw.zst
# Expected: "Zstandard compressed data"
```

### Step 3: Install zstd (if needed)

```bash
# macOS
brew install zstd

# Linux (Debian/Ubuntu)
sudo apt install zstd

# Linux (RHEL/CentOS)
sudo yum install zstd
```

### Step 4: Extract Image

```bash
# Extract the compressed image
zstd -d omnios-arm64.raw.zst

# This creates: omnios-arm64.raw (~8GB)
```

**Time:** ~1-2 minutes
**Result:** `omnios-arm64.raw` (~8GB uncompressed)

### Step 5: Convert to qcow2

```bash
# Convert raw image to qcow2 format (with progress)
qemu-img convert -f raw -O qcow2 -p omnios-arm64.raw omnios-arm64.qcow2
```

**Why qcow2?**
- Sparse allocation (uses only needed space)
- Snapshot support
- Better compression
- Standard cloud format

**Time:** ~2-3 minutes
**Result:** `omnios-arm64.qcow2` (~683MB actual, 58GB virtual)

### Step 6: Cleanup (Optional)

```bash
# Remove intermediate files to save space
rm omnios-arm64.raw.zst   # Compressed original (348MB)
rm omnios-arm64.raw        # Uncompressed raw (8GB)

# Keep only the qcow2 file
ls -lh omnios-arm64.qcow2
```

**Disk space saved:** ~8.3GB

---

## Verification

### Verify qcow2 Image

```bash
# Check image info
qemu-img info omnios-arm64.qcow2
```

**Expected output:**
```
image: omnios-arm64.qcow2
file format: qcow2
virtual size: 58 GiB (62277025792 bytes)
disk size: 683 MiB
cluster_size: 65536
Format specific information:
    compat: 1.1
    compression type: zlib
    lazy refcounts: false
    refcount bits: 16
    corrupt: false
    extended l2: false
```

### Test Boot

```bash
# Quick boot test (will exit automatically after you see it working)
./launch-omnios.sh
```

**What to look for:**
1. UEFI firmware loads
2. illumos loader starts
3. Kernel boots
4. Login prompt appears

Press `Ctrl-A` then `X` to exit QEMU.

---

## Alternative Sources

### Official OmniOS Mirrors

**US West (Primary):**
```bash
curl -L https://us-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst \
  -o omnios-arm64.raw.zst
```

**Europe:**
```bash
curl -L https://eu-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst \
  -o omnios-arm64.raw.zst
```

**Asia Pacific:**
```bash
curl -L https://ap-south.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst \
  -o omnios-arm64.raw.zst
```

### Direct Download

Visit: https://omnios.org/download.html
Select: ARM64 (Braich) -> r151055 -> Raw Image

---

## Advanced Configuration

### Resize Virtual Disk

If you need more than 58GB:

```bash
# Add 50GB (total will be 108GB virtual)
qemu-img resize omnios-arm64.qcow2 +50G

# Verify new size
qemu-img info omnios-arm64.qcow2
```

**After boot, inside OmniOS:**
```bash
# Expand ZFS pool
zpool set autoexpand=on rpool
zpool online -e rpool c0t0d0

# Verify
zpool list
```

### Optimize qcow2 Compression

For better compression (slower conversion):

```bash
qemu-img convert -f raw -O qcow2 -p -c \
  -o compression_type=zstd,cluster_size=2M \
  omnios-arm64.raw omnios-arm64.qcow2
```

Options:
- `-c`: Enable compression
- `-o compression_type=zstd`: Use zstd compression
- `-o cluster_size=2M`: Larger clusters for better performance

### Create Snapshot-Ready Image

```bash
# Convert with snapshot support
qemu-img convert -f raw -O qcow2 -p \
  -o compat=1.1,lazy_refcounts=on \
  omnios-arm64.raw omnios-arm64.qcow2

# Create a snapshot after first boot
qemu-img snapshot -c initial-boot omnios-arm64.qcow2

# List snapshots
qemu-img snapshot -l omnios-arm64.qcow2
```

---

## Troubleshooting

### Download Issues

**Problem:** Download is slow or stalls

**Solutions:**
```bash
# Use wget with resume support
wget -c https://us-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst \
  -O omnios-arm64.raw.zst

# Or curl with resume
curl -C - -L https://us-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst \
  -o omnios-arm64.raw.zst

# Try alternative mirror (see Alternative Sources above)
```

### Extraction Errors

**Problem:** `zstd: error` during extraction

**Solutions:**
```bash
# Check zstd version
zstd --version
# Need version 1.4.0 or later

# Update zstd
brew upgrade zstd  # macOS
sudo apt update && sudo apt upgrade zstd  # Linux

# Verify archive integrity
zstd -t omnios-arm64.raw.zst

# If corrupted, re-download
rm omnios-arm64.raw.zst
curl -L [URL] -o omnios-arm64.raw.zst
```

### Conversion Errors

**Problem:** `qemu-img convert` fails

**Solutions:**
```bash
# Check QEMU version
qemu-img --version
# Need version 5.0 or later

# Verify source file
file omnios-arm64.raw
# Should be: "DOS/MBR boot sector"

# Check disk space
df -h .
# Need at least 9GB free

# Try without progress flag
qemu-img convert -f raw -O qcow2 omnios-arm64.raw omnios-arm64.qcow2
```

### Insufficient Disk Space

**Problem:** Not enough space for extraction/conversion

**Solutions:**
```bash
# Check current usage
df -h .

# Option 1: Stream conversion (no intermediate raw file)
zstd -dc omnios-arm64.raw.zst | \
  qemu-img convert -f raw -O qcow2 - omnios-arm64.qcow2

# Option 2: Use different directory with more space
mkdir -p /path/to/large/disk/omnios
cd /path/to/large/disk/omnios
# Then follow normal steps
```

---

## File Management

### Expected Files

After complete setup:
```
omnios-production/
├── omnios-arm64.qcow2          ← Final VM image (keep)
├── launch-omnios.sh            ← Launch script
├── README.md                   ← Documentation
└── DOWNLOAD-OMNIOS.md          ← This file
```

### Optional Files (can delete after setup)
```
omnios-production/
├── omnios-arm64.raw.zst        ← Compressed download (348MB)
└── omnios-arm64.raw            ← Uncompressed raw (8GB)
```

### Disk Space Requirements

| Stage | Size | Cumulative |
|-------|------|------------|
| Download (.zst) | 348MB | 348MB |
| Extract (.raw) | 8GB | 8.3GB |
| Convert (.qcow2) | 683MB | 9GB |
| After cleanup | 683MB | 683MB |

---

## Image Information

### OmniOS Braich Details

- **OS:** OmniOS r151055
- **Architecture:** ARM64/aarch64 (Braich port)
- **Kernel:** illumos/arm64
- **Boot:** UEFI with illumos loader
- **File System:** ZFS (rpool)
- **Default User:** root (check OmniOS docs for password)
- **Network:** DHCP via virtio-net
- **SSH:** Enabled by default

### What's Included

- illumos kernel (ARM64)
- ZFS file system with compression
- DTrace observability framework
- Zone management utilities
- Basic system utilities
- Network configuration tools
- Package manager (pkg)

### What's NOT Included

- GUI/Desktop environment (text console only)
- Web browser
- Development tools (install with pkg)
- Application software (install with pkg or in zones)

---

## After Download

### Initial Setup

1. **Verify image:**
   ```bash
   qemu-img info omnios-arm64.qcow2
   ```

2. **First boot:**
   ```bash
   ./launch-omnios.sh
   ```

3. **Login:**
   - Wait for login prompt (~15-20 seconds)
   - Login as root (check OmniOS docs for default password)

4. **Basic configuration:**
   ```bash
   # Inside OmniOS
   hostname omnios-vibecode

   # Configure network (usually automatic with DHCP)
   dladm show-phys
   ipadm show-addr

   # Update system
   pkg update
   ```

### Create Backup

Before making changes:

```bash
# Create a backup copy
cp omnios-arm64.qcow2 omnios-arm64-backup.qcow2

# Or create a snapshot
qemu-img snapshot -c initial-state omnios-arm64.qcow2
```

---

## Cloud Deployment

### Prepare for AWS Graviton

```bash
# 1. Convert to raw for AMI creation
qemu-img convert -f qcow2 -O raw omnios-arm64.qcow2 omnios-arm64-aws.raw

# 2. Upload to S3
aws s3 cp omnios-arm64-aws.raw s3://your-bucket/omnios-arm64.raw

# 3. Import as AMI (see AWS docs)
aws ec2 import-snapshot --disk-container Format=raw,UserBucket="{S3Bucket=your-bucket,S3Key=omnios-arm64.raw}"
```

### Prepare for Oracle Cloud

```bash
# 1. Convert to qcow2 (already done)
# Oracle Cloud accepts qcow2 directly

# 2. Upload via OCI CLI
oci os object put --bucket-name your-bucket --file omnios-arm64.qcow2

# 3. Create custom image (see Oracle docs)
oci compute image create --compartment-id [OCID] --bucket-name your-bucket
```

---

## Updates and Maintenance

### Check for New Releases

Visit: https://omnios.org/download.html

OmniOS releases follow this pattern:
- **r151055** = Current release (October 2025)
- **r151053** = Previous LTS
- New releases every ~6 months

### Update Downloaded Image

```bash
# Inside running VM
pkg update
pkg list -v

# After updates, shutdown cleanly
shutdown -h now
```

---

## Support Resources

### Official Resources

- **Website:** https://omnios.org
- **Documentation:** https://omnios.org/documentation
- **Downloads:** https://omnios.org/download.html
- **GitHub:** https://github.com/omniosorg
- **Release Notes:** https://omnios.org/releasenotes/

### Community

- **IRC:** `#illumos` on Libera.Chat
- **Mailing List:** omnios-discuss@lists.omnios.org
- **GitHub Issues:** For OmniOS bugs and features

### Commercial Support

- OmniOS Community Edition Association
- Contact: https://omnios.org/about/contact.html

---

## FAQ

**Q: Why is the download so large compared to Alpine?**
A: OmniOS includes a full ZFS root pool, kernel, system utilities, and enterprise features. Alpine is minimal by design.

**Q: Can I use this on x86_64?**
A: No, this is ARM64 only. For x86_64, download the standard OmniOS release.

**Q: Is this stable for production?**
A: Yes, OmniOS is production-ready. The ARM64 port (Braich) is actively maintained.

**Q: How do I install software?**
A: Use `pkg install` for system packages, or create an LX zone and use `apt` for Debian packages.

**Q: Can I run Docker containers?**
A: Not natively, but you can create LX zones which provide similar functionality with better isolation.

---

**Ready to download?**

```bash
cd omnios-production
curl -L https://us-west.mirror.omnios.org/downloads/braich/151055/braich-151055.raw.zst -o omnios-arm64.raw.zst
zstd -d omnios-arm64.raw.zst
qemu-img convert -f raw -O qcow2 -p omnios-arm64.raw omnios-arm64.qcow2
./launch-omnios.sh
```

---

*OmniOS: Enterprise-grade illumos distribution for the modern datacenter.*
