# Fast OpenVSCode Server on vfkit

**Quick setup to run Gitpod's OpenVSCode Server on Apple Silicon with vfkit**

---

## What This Is

A minimal, fast-booting VM setup for running OpenVSCode Server (browser-based VS Code) on macOS with Apple Silicon using vfkit and Alpine Linux.

**Performance:**
- Boot time: ~6-8 seconds
- Memory: ~300-400MB (with VS Code Server running)
- Rootfs: 54MB (Node.js 24) + 67MB (OpenVSCode Server) = 121MB total

---

## Quick Start (Recommended Method)

### Prerequisites

```bash
# Install vfkit (if not already installed)
brew install vfkit

# Or run the setup script
../scripts/vfkit/01-setup-vfkit.sh
```

### Option 1: Use Existing Alpine + Node 24 + Manual Install (FASTEST)

This is the **fastest and most reliable** method:

```bash
# 1. Build Alpine 3.22 + Node 24 rootfs (if not already done)
cd ../scripts/vfkit
./10-upgrade-to-alpine-3.22.sh     # Get Alpine 3.22 kernel
./08-create-node24-rootfs.sh       # Build Node 24 rootfs (takes 2-3 min)

# 2. Launch the VM
./09-launch-node24-vm.sh

# 3. Inside the VM: Install OpenVSCode Server
# First, on your Mac, start a simple HTTP server:
cd ../scripts/vfkit
python3 -m http.server 8000

# Then in the VM, run:
wget http://10.0.2.2:8000/install-vscode-server.sh
chmod +x install-vscode-server.sh
./install-vscode-server.sh

# 4. Start OpenVSCode Server
start-vscode

# 5. Access from your Mac
# Open browser: http://localhost:3000
```

**Pros:**
- ✅ Fast boot (6.48s)
- ✅ Reliable Alpine Linux base
- ✅ Easy to customize
- ✅ Latest Node.js 24 + npm 11.6.1
- ✅ Works perfectly

**Cons:**
- ⚠️ Requires manual VS Code install on first boot (one-time, takes ~2 minutes)

---

### Option 2: Prebaked Rootfs with VS Code (EXPERIMENTAL)

This would be the ultimate fast setup, but currently has boot issues:

```bash
# 1. Build prebaked rootfs with OpenVSCode Server
cd ../scripts/vfkit
./12-create-vscode-server-rootfs.sh   # Takes 3-4 min, downloads 67MB

# 2. Launch VM with prebaked VS Code
./13-launch-vscode-server-vm.sh

# 3. Access from your Mac
# Open browser: http://localhost:3000
```

**Current Status:** ⚠️ Does not boot properly (kernel panic - needs disk-based root)

**Why it doesn't work:**
- Alpine's kernel expects a real root filesystem
- Pure initramfs boot requires special kernel configuration
- Workaround needed: proper disk image with ext4 filesystem

**To fix:** Would need to:
1. Create proper ext4 disk image
2. Install Alpine to disk
3. Or modify kernel/init to support pure initramfs mode

---

## What Gets Installed

### In the VM

- **Alpine Linux 3.22.2** - Latest stable (October 2025)
- **Linux kernel 6.12 LTS** - Latest long-term support
- **Node.js 24.10.0** - musl-optimized from unofficial-builds.nodejs.org
- **npm 11.6.1** - Latest package manager
- **OpenVSCode Server v1.105.1** - Gitpod's latest (ARM64 native)

### On Your Mac

- **vfkit** - Native Apple Virtualization.framework
- **VM files** in `~/.vfkit/vms/vibecode-alpine/`

---

## Usage

### Starting OpenVSCode Server

After the VM boots, inside the VM:

```bash
# Basic start
start-vscode

# Custom port
start-vscode --port 8080

# With authentication token
start-vscode --connection-token mySecretToken123

# Custom workspace
start-vscode /path/to/workspace
```

### Accessing from macOS

Open your browser:
```
http://localhost:3000
```

Or if you changed the port:
```
http://localhost:8080
```

### Installing VS Code Extensions

In the VS Code Server terminal:
```bash
# Install extension
/opt/openvscode-server/bin/openvscode-server \
  --install-extension dbaeumer.vscode-eslint

# Or use the Extensions panel in the browser UI
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser (macOS)                         │
│  └─ http://localhost:3000                │
├─────────────────────────────────────────┤
│  Alpine Linux 3.22 VM (ARM64)            │
│  ├─ OpenVSCode Server v1.105.1           │
│  ├─ Node.js 24.10.0 (musl)               │
│  ├─ npm 11.6.1                            │
│  └─ Linux kernel 6.12 LTS                 │
├─────────────────────────────────────────┤
│  vfkit (Apple Virtualization)            │
│  ├─ Virtualization.framework             │
│  ├─ virtio devices                        │
│  └─ NAT networking                        │
├─────────────────────────────────────────┤
│  macOS (Ventura+)                         │
│  └─ Apple Silicon (M1/M2/M3/M4)          │
└─────────────────────────────────────────┘
```

---

## Files and Scripts

### Build Scripts

Located in `../scripts/vfkit/`:

| Script | Purpose | Time |
|--------|---------|------|
| `01-setup-vfkit.sh` | Install vfkit | < 1 min |
| `10-upgrade-to-alpine-3.22.sh` | Get Alpine 3.22 kernel | 1-2 min |
| `08-create-node24-rootfs.sh` | Build Node 24 rootfs | 2-3 min |
| `09-launch-node24-vm.sh` | Launch VM | Instant |
| `install-vscode-server.sh` | Install VS Code in VM | 2 min |
| `12-create-vscode-server-rootfs.sh` | Build prebaked VS Code rootfs | 3-4 min |
| `13-launch-vscode-server-vm.sh` | Launch prebaked VM | Instant |

### Documentation

| File | Description |
|------|-------------|
| `../scripts/vfkit/README.md` | Main documentation |
| `../scripts/vfkit/WIKI.md` | 500+ line comprehensive guide |
| `../scripts/vfkit/VSCODE_SERVER_SETUP.md` | VS Code Server details |
| `../scripts/vfkit/INDEX.md` | Documentation navigation |

---

## Performance Benchmarks

### Boot Time

| Method | Boot Time | Notes |
|--------|-----------|-------|
| **Alpine + Node 24 + Manual Install** | 6.48s | Recommended |
| **Prebaked VS Code rootfs** | TBD | Currently doesn't boot |
| **Lima (comparison)** | 15.15s | 57% slower |

### Resource Usage

| Resource | Usage | Notes |
|----------|-------|-------|
| **Memory (idle)** | ~200MB | Just Alpine + Node |
| **Memory (with VS Code)** | ~350MB | VS Code Server running |
| **Disk (rootfs)** | 54MB | Node 24 rootfs |
| **Disk (+ VS Code)** | 121MB | Total with VS Code |
| **Network** | ~1.2Gbps | virtio-net |
| **Disk I/O** | ~2GB/s | virtio-blk |

---

## Troubleshooting

### VM won't boot

Check kernel and rootfs:
```bash
ls -lh ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux
ls -lh ~/.vfkit/vms/vibecode-alpine/rootfs/alpine-node24-rootfs.cpio.gz
```

### Can't access VS Code Server

Check if it's running:
```bash
# Inside VM
ps aux | grep openvscode-server
netstat -tuln | grep 3000
```

Try different port:
```bash
start-vscode --port 8080
```

### VS Code Server won't install

Make sure you have the install script:
```bash
# On Mac
cd ../scripts/vfkit
python3 -m http.server 8000

# In VM
wget http://10.0.2.2:8000/install-vscode-server.sh
```

Or copy/paste directly - see `../scripts/vfkit/install-vscode-server.sh`

---

## Comparison: Manual vs Prebaked

| Aspect | Manual Install | Prebaked Rootfs |
|--------|---------------|-----------------|
| **Setup time** | 5-7 min first time | 3-4 min build |
| **Boot time** | 6.48s | TBD (doesn't boot yet) |
| **First boot** | Need to install VS Code | Ready instantly |
| **Reliability** | ✅ Works perfectly | ❌ Kernel panic |
| **Flexibility** | ✅ Easy to customize | Limited |
| **Recommended** | ✅ Yes | ⚠️ Experimental |

---

## Why Use This Instead of Docker?

| Feature | Docker Desktop | vfkit + Alpine |
|---------|----------------|----------------|
| **Hypervisor** | QEMU/HyperKit | Native Virtualization.framework |
| **Boot time** | 20-30s | 6.5s |
| **Memory** | 6-8GB | 4GB (or less) |
| **License** | Proprietary | Open Source |
| **Performance** | Good | Excellent (native) |

---

## Next Steps

1. ✅ **Use the manual install method** (recommended)
   - Follow Option 1 above
   - Works reliably, fast boot, easy to maintain

2. ⏳ **Fix prebaked rootfs boot** (for ultimate speed)
   - Create proper ext4 disk image
   - Or modify kernel to support pure initramfs
   - Would enable instant VS Code Server access

3. ⏳ **Add more features**
   - Pre-install popular VS Code extensions
   - Add development tools (git, docker cli, etc.)
   - Create variants for different use cases

---

## Resources

- **OpenVSCode Server**: https://github.com/gitpod-io/openvscode-server
- **vfkit**: https://github.com/crc-org/vfkit
- **Alpine Linux**: https://alpinelinux.org/
- **Node.js unofficial builds**: https://unofficial-builds.nodejs.org/

---

## Support

- **Documentation**: See `../scripts/vfkit/WIKI.md` for comprehensive guide
- **Troubleshooting**: See `../scripts/vfkit/WIKI.md` (15+ common issues)
- **Issues**: Open issue on GitHub

---

**Status**: ✅ Ready to use with manual install method
**Performance**: 6.48s boot, ~350MB memory with VS Code Server
**Recommended**: Use Option 1 (manual install) for reliability
