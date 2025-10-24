# VibeCode on Alpine ARM64 with vfkit - Quick Start

## Overview

This guide helps you run vibecode-webgui in an Alpine Linux ARM64 VM using vfkit on macOS Apple Silicon.

## Current Status

✅ **Working:**
- Alpine Linux 3.19 ARM64 VM boots successfully
- Node.js 20.11.1 installed and working
- Network connectivity (NAT)
- 4 CPUs, 4GB RAM configured

⚠️ **Known Limitations:**
- VirtioFS directory sharing requires kernel modules not in minimal initramfs
- Services (PostgreSQL, Redis) need manual installation

## Recommended Approach

### Option 1: Development on Host, Testing in VM (Recommended)

**Best for:** Quick testing of ARM64 compatibility

1. Develop on your Mac as normal
2. Build the project: `npm run build`
3. Create a tarball: `tar -czf vibecode.tar.gz dist/ package.json node_modules/`
4. Transfer to VM via HTTP server
5. Run in VM for ARM64 testing

### Option 2: Full Alpine Installation

**Best for:** Complete ARM64 development environment

Install Alpine to disk with full package support:

```bash
# 1. Create larger disk image
./scripts/vfkit/07-create-persistent-vm.sh

# 2. Boot Alpine installer
./scripts/vfkit/04-launch-alpine-vm.sh

# 3. In VM, run: setup-alpine
# Follow prompts to install to /dev/vda

# 4. After reboot, install packages:
apk add nodejs npm postgresql redis git build-base
```

### Option 3: Docker/Lima Alternative

**Best for:** Full feature parity with development

Consider using:
- **Lima**: `brew install lima` - Better virtio-fs support
- **OrbStack**: Native macOS containers with better file sharing
- **Colima**: Docker Desktop alternative with virtio-fs

## Current VM Capabilities

### What Works Now

```bash
# Start the VM
./scripts/vfkit/04-launch-alpine-vm.sh

# In the VM:
node --version     # ✅ v20.11.1
npm --version      # ✅ Works
apk add package    # ✅ Package manager works
```

### Network File Transfer (Workaround for VirtioFS)

**Host side (macOS):**
```bash
cd /Users/studio/Documents/vibecode-webgui
python3 -m http.server 8000
```

**VM side:**
```sh
# Get your Mac's IP
# From VM: wget http://192.168.64.1:8000/vibecode.tar.gz
# (Replace IP with your Mac's IP)
```

## Installing Services in VM

Once inside the Alpine VM:

```sh
# Run the service setup script
wget http://YOUR_MAC_IP:8000/scripts/vfkit/vm-setup-services.sh
chmod +x vm-setup-services.sh
./vm-setup-services.sh

# This installs:
# - PostgreSQL
# - Redis
# - Build tools
# - Python
# - Supervisor for service management
```

## Troubleshooting

### VirtioFS "Failed to mount" Error

**Expected behavior** - The minimal initramfs doesn't include virtiofs kernel module.

**Solutions:**
1. Use network file transfer (see above)
2. Install full Alpine system to disk
3. Use Lima/Colima instead for better file sharing

### VM Won't Boot

```bash
# Check console log
tail -f ~/.vfkit/vms/vibecode-alpine/logs/console.log

# Verify kernel is uncompressed
file ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux
# Should show: Linux kernel ARM64 boot executable
```

### Node.js Not Found

```bash
# Rebuild rootfs
./scripts/vfkit/06-create-vibecode-rootfs.sh

# Verify in VM
which node
node --version
```

## Performance Expectations

- **Boot time:** ~2-3 seconds
- **Memory:** 4GB allocated (configurable via VFKIT_MEMORY)
- **CPUs:** 4 cores (configurable via VFKIT_CPUS)
- **Network:** NAT (outbound works, inbound requires port forwarding)

## Next Steps for Full Integration

To make vibecode-webgui fully functional in the VM:

1. **Install to Disk** (enables virtiofs kernel modules)
   ```bash
   ./scripts/vfkit/07-create-persistent-vm.sh
   ```

2. **Network Port Forwarding**
   - vfkit doesn't support port forwarding directly
   - Use SSH tunneling or reverse proxy
   - Or access via VM's DHCP IP

3. **Database Setup**
   ```sh
   # In VM after installing services
   start-services
   su postgres -c "createdb vibecode"
   ```

4. **Run VibeCode**
   ```sh
   cd /path/to/code
   npm install
   cp .env.example .env
   # Edit .env
   npx prisma migrate deploy
   npm run build
   npm start
   ```

## Alternative: Use Lima

For better macOS integration:

```bash
brew install lima

# Create Alpine VM with virtio-fs
limactl start --name=vibecode \
  --vm-type=vz \
  --mount-type=virtiofs \
  --cpus=4 \
  --memory=4 \
  --disk=20 \
  template://alpine

# Access
limactl shell vibecode

# Your /Users is automatically mounted!
```

## Files Created

- `01-setup-vfkit.sh` - Install vfkit
- `02-download-alpine-kernel.sh` - Download Alpine kernel
- `03-create-alpine-rootfs.sh` - Create basic rootfs
- `04-launch-alpine-vm.sh` - Launch VM (basic)
- `05-launch-vibecode-vm.sh` - Launch with virtiofs (needs full install)
- `06-create-vibecode-rootfs.sh` - Create VibeCode-optimized rootfs
- `vm-setup-services.sh` - Install PostgreSQL, Redis, etc.

## Conclusion

The vfkit Alpine VM is working, but virtiofs requires a full Alpine installation rather than initramfs-only boot. For development, consider:

1. **Quick ARM64 testing:** Use current setup + network file transfer
2. **Full development:** Install Alpine to disk OR use Lima
3. **Production-like:** Use Docker/OrbStack for better integration

Choose based on your specific needs!
