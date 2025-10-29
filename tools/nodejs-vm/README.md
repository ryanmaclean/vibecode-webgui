# Node.js VM - Standalone Runner

Native macOS Virtualization framework runner for Node.js v22 LTS development.

## Features

- Node.js v22.21.1 LTS
- Rosetta 2 for x86_64 binaries
- Shared workspace at `~/vibecode-workspace`
- PostgreSQL + pgvector (via Lima disk)
- Valkey (via Lima disk)
- Build tools and Git

## Quick Start

### Build

```bash
cd tools/nodejs-vm
swift build -c release
```

### Run

```bash
# Run indefinitely (Ctrl+C to stop)
.build/release/nodejs-vm

# Run for 60 seconds
.build/release/nodejs-vm 60
```

## Requirements

- macOS 14.0+
- Alpine kernel at `~/.vfkit/vms/vibecode-alpine/kernel/`
- Lima disk at `~/.lima/vibecode-nodejs/diffdisk` (or existing disk at `~/.vfkit/vms/nodejs-vz/disk/root.qcow2`)

## Usage

Once the VM boots:

1. Login as `root` (password from Lima setup)
2. Check Node.js: `node --version` → v22.21.1
3. Access workspace: `cd /workspace`
4. Run your code: `node /workspace/test.js`

## Workspace

Files in `~/vibecode-workspace` are automatically synced:

```bash
# On macOS host
echo "console.log('hello');" > ~/vibecode-workspace/app.js

# In VM
node /workspace/app.js
```

## Architecture

- **VM Manager**: Apple Virtualization framework
- **Kernel**: Alpine Linux (from Lima)
- **Disk**: QCOW2 image from Lima (50GB)
- **Network**: NAT (internet access)
- **Sharing**: VirtioFS (native macOS)
- **Rosetta 2**: x86_64 binary translation

## Troubleshooting

### Kernel not found
```bash
# Check Lima VM has Alpine kernel
ls ~/.vfkit/vms/vibecode-alpine/kernel/
```

### Disk not found
```bash
# Copy from Lima
cp ~/.lima/vibecode-nodejs/diffdisk ~/.vfkit/vms/nodejs-vz/disk/root.qcow2
```

### VM won't start
```bash
# Check macOS version
sw_vers  # Should be 14.0+

# Check Virtualization framework
system_profiler SPHardwareDataType
```
