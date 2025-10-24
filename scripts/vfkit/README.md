# VibeCode Alpine VM with vfkit

Run VibeCode in a lightweight Alpine Linux VM using vfkit on macOS with Apple Silicon.

## Overview

This setup creates a minimal Alpine Linux ARM64 virtual machine optimized for:

- **Development**: Node.js, npm, code-server
- **Performance**: Native Apple Silicon support via vfkit
- **Efficiency**: Alpine Linux with musl libc (smaller, faster)
- **Simplicity**: One-command installation

## Requirements

- **macOS**: 13.0 (Ventura) or later
- **Architecture**: Apple Silicon (M1/M2/M3) recommended
- **Tools**: Homebrew, vfkit (auto-installed)
- **Space**: ~500MB for VM files
- **Memory**: 4GB RAM allocated to VM

## Quick Start

### One-Command Install

```bash
./scripts/vfkit/install-alpine-vm.sh
```

This runs all setup steps automatically:
1. Installs vfkit (if needed)
2. Downloads Alpine kernel (~50MB)
3. Creates custom rootfs (~200MB)
4. Launches the VM

### Manual Installation

Run each step individually:

```bash
# Step 1: Setup vfkit
./scripts/vfkit/01-setup-vfkit.sh

# Step 2: Download Alpine kernel
./scripts/vfkit/02-download-alpine-kernel.sh

# Step 3: Create rootfs with Node.js
./scripts/vfkit/03-create-alpine-rootfs.sh

# Step 4: Launch VM
./scripts/vfkit/04-launch-alpine-vm.sh
```

## What Gets Installed

### In the VM

- **Alpine Linux 3.19**: Lightweight distribution
- **Node.js 20.11**: JavaScript runtime (musl-compatible)
- **npm**: Package manager
- **APK**: Alpine package manager
- **Network**: Configured with DHCP
- **Helper scripts**: verify-nodejs, quick-start

### On Your Mac

- **vfkit**: Native virtualization tool
- **VM Files** in `~/.vfkit/vms/vibecode-alpine/`:
  - `kernel/` - Linux kernel and initramfs
  - `rootfs/` - Custom root filesystem
  - `disk/` - VM disk image (20GB)
  - `logs/` - Console logs

## Usage

### Launch the VM

```bash
./scripts/vfkit/04-launch-alpine-vm.sh
```

The VM boots directly to a shell prompt.

### Inside the VM

Verify Node.js installation:
```bash
verify-nodejs
```

Quick start guide:
```bash
quick-start
```

Install packages:
```bash
apk add vim git
```

Install Node.js packages:
```bash
npm install -g code-server
```

Start code-server:
```bash
code-server --bind-addr 0.0.0.0:8080 --auth none
```

### Access from macOS

Code-server will be available at:
```
http://localhost:8080
```

### Stop the VM

Press `Ctrl+C` in the terminal running the VM.

## Configuration

### Customize VM Resources

Set environment variables before launching:

```bash
# CPUs (default: 4)
export VFKIT_CPUS=2

# Memory in MB (default: 4096)
export VFKIT_MEMORY=2048

# Disk size (default: 20G)
export VFKIT_DISK_SIZE=10G

# Launch with custom config
./scripts/vfkit/04-launch-alpine-vm.sh
```

### Modify Scripts

Edit `04-launch-alpine-vm.sh` to change:
- Port forwarding
- Network configuration
- Device attachments
- Kernel command line

## File Locations

```
~/.vfkit/vms/vibecode-alpine/
├── kernel/
│   ├── vmlinuz                  # Alpine Linux kernel
│   ├── initramfs                # Alpine initramfs
│   └── alpine-*.iso             # Downloaded ISO
├── rootfs/
│   ├── alpine-vibecode-rootfs.cpio.gz  # Custom rootfs
│   └── build/                   # Build artifacts
├── disk/
│   └── root.img                 # VM disk (20GB)
└── logs/
    ├── console.log              # VM console output
    └── *.log                    # Other logs
```

## Architecture

```
┌─────────────────────────────────────┐
│  Applications                        │
│  ├─ code-server (port 8080)         │
│  ├─ Node.js apps                     │
│  └─ npm packages                     │
├─────────────────────────────────────┤
│  Alpine Linux 3.19 (ARM64)          │
│  ├─ musl libc                        │
│  ├─ Node.js 20.11                    │
│  ├─ APK package manager              │
│  └─ Networking (virtio-net)          │
├─────────────────────────────────────┤
│  vfkit                               │
│  ├─ Virtualization.framework        │
│  ├─ virtio devices                   │
│  └─ NAT networking                   │
├─────────────────────────────────────┤
│  macOS Host (Ventura+)               │
│  └─ Apple Silicon M1/M2/M3           │
└─────────────────────────────────────┘
```

## Troubleshooting

### vfkit not found

```bash
# Install vfkit
brew install vfkit

# Verify installation
vfkit --version
```

### Kernel or initramfs not found

```bash
# Re-download Alpine components
rm -rf ~/.vfkit/vms/vibecode-alpine/kernel
./scripts/vfkit/02-download-alpine-kernel.sh
```

### Kernel compression error

If you see `kernel must be uncompressed` error:

```bash
# The download script should automatically extract vmlinux
# If it didn't, manually extract it:
cd ~/.vfkit/vms/vibecode-alpine/kernel

# Extract gzip payload from vmlinuz
python3 << 'EOF'
with open('vmlinuz', 'rb') as f:
    data = f.read()
offset = data.find(b'\x1f\x8b')
if offset >= 0:
    with open('vmlinuz.gz', 'wb') as f:
        f.write(data[offset:])
EOF

# Decompress to vmlinux
gunzip -c vmlinuz.gz > vmlinux
rm vmlinuz.gz

# Verify
file vmlinux  # Should show: Linux kernel ARM64 boot executable
```

### VM won't boot

Check console log:
```bash
tail -f ~/.vfkit/vms/vibecode-alpine/logs/console.log
```

Enable debug mode by editing `04-launch-alpine-vm.sh`:
```bash
# Change this line:
CMDLINE="console=hvc0 root=/dev/vda rw quiet"

# To this:
CMDLINE="console=hvc0 root=/dev/vda rw debug loglevel=7"
```

### Node.js not working

Verify it's the musl build:
```bash
# Inside VM
ldd /usr/local/bin/node

# Should show 'musl' or be a static binary
```

Reinstall if needed:
```bash
# Outside VM, rebuild rootfs
./scripts/vfkit/03-create-alpine-rootfs.sh
```

### Port 8080 conflicts

Find what's using it:
```bash
lsof -ti:8080
```

Kill the process:
```bash
kill $(lsof -ti:8080)
```

Or change the port in code-server:
```bash
code-server --bind-addr 0.0.0.0:8081 --auth none
```

### Clean Install

Remove all VM files and start over:
```bash
rm -rf ~/.vfkit/vms/vibecode-alpine
./scripts/vfkit/install-alpine-vm.sh
```

## Advanced Usage

### Access VM Console Directly

```bash
# vfkit provides console via virtio-serial
# Logs go to ~/.vfkit/vms/vibecode-alpine/logs/console.log
tail -f ~/.vfkit/vms/vibecode-alpine/logs/console.log
```

### Persistent Data

Data is stored in the VM disk image:
```
~/.vfkit/vms/vibecode-alpine/disk/root.img
```

To backup:
```bash
cp ~/.vfkit/vms/vibecode-alpine/disk/root.img \
   ~/backups/vibecode-vm-$(date +%Y%m%d).img
```

### Custom Packages in Rootfs

Edit `03-create-alpine-rootfs.sh` and add packages before creating the cpio archive:

```bash
# In the script, before 'find . | cpio ...'
apk add --root . vim git curl
```

Then rebuild:
```bash
./scripts/vfkit/03-create-alpine-rootfs.sh
```

### Network Access

The VM uses NAT networking via virtio-net:
- **Outbound**: Full internet access
- **Inbound**: Requires port forwarding or bridged networking

For bridged networking, modify the vfkit command in `04-launch-alpine-vm.sh`.

## Performance

Expected performance on Apple Silicon:

| Metric | Value |
|--------|-------|
| Boot Time | < 3 seconds |
| Memory Usage | 4GB (configurable) |
| Disk I/O | Near-native NVMe speeds |
| CPU Overhead | < 5% idle |
| Network | 1+ Gbps |

## Comparison with Docker

| Feature | Docker Desktop | vfkit + Alpine |
|---------|----------------|----------------|
| Hypervisor | QEMU/HyperKit | Native (Virtualization.framework) |
| Linux Distro | Docker Linux | Alpine Linux |
| Libc | glibc | musl libc |
| Boot Time | 10-30s | < 3s |
| Memory | 6-8GB | 4GB |
| Disk | 60GB+ | 20GB |
| License | Proprietary | Open Source |

## Contributing

To improve these scripts:

1. Test on your Mac
2. Make changes
3. Test again
4. Submit PR with description

## Resources

- [vfkit documentation](https://github.com/crc-org/vfkit)
- [Alpine Linux](https://alpinelinux.org/)
- [Node.js unofficial builds](https://unofficial-builds.nodejs.org/)
- [Virtualization.framework](https://developer.apple.com/documentation/virtualization)

## License

MIT - See repository LICENSE file

## Support

For issues:
1. Check troubleshooting section above
2. Review console logs
3. Open GitHub issue with logs

---

**Quick Reference**

```bash
# Install
./scripts/vfkit/install-alpine-vm.sh

# Launch
./scripts/vfkit/04-launch-alpine-vm.sh

# Logs
tail -f ~/.vfkit/vms/vibecode-alpine/logs/console.log

# Clean
rm -rf ~/.vfkit/vms/vibecode-alpine
```
