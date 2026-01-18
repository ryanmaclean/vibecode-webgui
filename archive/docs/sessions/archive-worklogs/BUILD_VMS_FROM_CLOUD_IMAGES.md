# Build VMs from Alpine Cloud Images (Advanced)

## If You Want to Build Custom vfkit VMs

This approach gives you full control but takes more time.

## Step 1: Download Alpine Cloud Images

```bash
# Create images directory
mkdir -p ~/.vibecode/images

cd ~/.vibecode/images

# Download Alpine 3.22 cloud image
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2

# Verify SHA512
echo "30b347397387926eeb939d93c926e09833f5b49c6c6de5cc225ccdfe6e54aba88251c71da264c7e4260e78132b50e34b93409c8b4da2e843e68a4dc35fc6b155  nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2" | shasum -a 512 -c
```

## Step 2: Convert qcow2 to Raw

```bash
# Install qemu-img if not present
brew install qemu

# Convert to raw format (vfkit prefers raw)
qemu-img convert -f qcow2 -O raw \
  nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2 \
  alpine-3.22-base.raw
```

## Step 3: Create cloud-init Config

### For Valkey VM

```bash
mkdir -p ~/.vibecode/cloud-init/valkey

# Create user-data
cat > ~/.vibecode/cloud-init/valkey/user-data <<EOF
#cloud-config
hostname: vibecode-valkey
manage_etc_hosts: true

packages:
  - valkey
  - valkey-cli

write_files:
  - path: /etc/valkey/valkey.conf
    content: |
      bind 0.0.0.0
      port 6379
      protected-mode no
      maxmemory 512mb
      maxmemory-policy allkeys-lru
      save 900 1

runcmd:
  - systemctl enable valkey
  - systemctl start valkey
EOF

# Create meta-data
cat > ~/.vibecode/cloud-init/valkey/meta-data <<EOF
instance-id: vibecode-valkey-001
local-hostname: vibecode-valkey
EOF

# Generate cloud-init ISO
hdiutil makehybrid -o ~/.vibecode/cloud-init/valkey/seed.iso \
  -hfs -joliet -iso -default-volume-name cidata \
  ~/.vibecode/cloud-init/valkey/
```

## Step 4: Launch VM with vfkit

```bash
# Copy base image for Valkey
cp ~/.vibecode/images/alpine-3.22-base.raw ~/.vibecode/vms/vibecode-valkey/disk.raw

# Launch with vfkit
vfkit \
  --cpus 2 \
  --memory 1024 \
  --bootloader efi,variable-store=~/.vibecode/vms/vibecode-valkey/efi.bin,create \
  --device virtio-blk,path=~/.vibecode/vms/vibecode-valkey/disk.raw \
  --device virtio-blk,path=~/.vibecode/cloud-init/valkey/seed.iso \
  --device virtio-net,nat,mac=52:54:00:12:34:59 \
  --device virtio-serial,logFilePath=~/.vibecode/vms/vibecode-valkey/console.log \
  --device virtio-rng
```

## Why This is More Work

| Task | Lima | Manual vfkit |
|------|------|--------------|
| Download images | Auto | Manual curl |
| Convert format | Auto | qemu-img |
| cloud-init setup | Config file | Manual ISO creation |
| Port forwarding | Config | NAT setup |
| EFI bootloader | Auto | Manual creation |
| Persistence | Built-in | Manual scripts |

## Recommended: Use Lima Instead

Unless you need very specific customization, Lima handles all of this for you.

## Alternative: Pre-built Disk Images

You can also create "golden images" with all software pre-installed:

1. Boot base Alpine cloud image
2. SSH in and install everything
3. Shutdown VM
4. Clone disk image for each service
5. Use clones as base images

This approach is used in production but requires:
- Image building pipeline
- Version management
- Update process
- Storage for multiple images

## Other Cloud Image Sources

### Fedora CoreOS
- URL: `https://builds.coreos.fedoraproject.org/`
- Format: qcow2 / raw
- Uses: Ignition (similar to cloud-init)
- Good for: Container-focused workloads

### Ubuntu Cloud Images
- URL: `https://cloud-images.ubuntu.com/`
- ARM64 available
- cloud-init native
- Larger than Alpine (~300MB vs ~60MB)

### Debian Cloud Images
- URL: `https://cloud.debian.org/images/cloud/`
- ARM64 available
- Good middle ground

## Summary

**For VibeCode:**
- ✅ Use Lima (quickest path to working VMs)
- ✅ Alpine cloud images (lightweight, fast)
- ✅ Already have configs in `config/lima/`

**Time comparison:**
- Lima: 5 minutes to all 4 VMs running
- Manual vfkit + cloud images: 1-2 hours
- Custom initramfs (current approach): 3+ hours

**Recommendation:** Run Lima now, build custom images later if needed.

