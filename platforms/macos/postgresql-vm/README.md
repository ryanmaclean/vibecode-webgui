# PostgreSQL VM - Native macOS Virtualization Framework

A production-ready PostgreSQL 16 + pgvector VM using Apple's Virtualization framework, built by leveraging Lima's working PostgreSQL VM infrastructure.

## Overview

This PostgreSQL VM implementation uses:
- **Apple Virtualization Framework**: Native macOS virtualization (no QEMU/libvirt overhead)
- **Lima's PostgreSQL Disk**: Proven, working PostgreSQL 16 installation with pgvector
- **Alpine Linux Kernel**: Lightweight, fast boot
- **Dual-Disk Architecture**: Separate root and data disks for optimal performance

## Architecture

### VM Configuration
- **CPU**: 4 cores (optimized for vector operations)
- **Memory**: 8GB (suitable for vector workloads)
- **Root Disk**: 20GB QCOW2 (from Lima, contains OS + PostgreSQL)
- **Data Disk**: 100GB QCOW2 (dedicated PostgreSQL data directory)
- **Network**: NAT (accessible on 127.0.0.1:5432)

### Directory Structure
```
~/.vfkit/vms/postgresql-vz/
├── disk/
│   ├── root.qcow2       # 20GB - Copied from Lima
│   └── data.qcow2       # 100GB - PostgreSQL data
└── kernel/
    ├── vmlinuz          # Alpine Linux kernel
    └── initramfs        # Alpine initramfs
```

### Source Structure
```
platforms/macos/postgresql-vm/
├── Package.swift        # Swift package definition
├── Sources/
│   └── main.swift       # PostgreSQL VM implementation
└── README.md            # This file
```

## Prerequisites

1. **macOS 14.0+**: Required for Virtualization framework features
2. **Lima PostgreSQL VM**: Must have run successfully
3. **Alpine Kernel**: Must be extracted
4. **qemu-img**: For disk management

## Setup

### 1. Verify Prerequisites

```bash
# Check Lima PostgreSQL VM is available
limactl list | grep vibecode-pgvector

# Check Lima disk exists
ls -lh ~/.lima/vibecode-pgvector/diffdisk

# Check Alpine kernel
ls -lh ~/.vfkit/vms/vibecode-alpine/kernel/
```

### 2. Build the VM

The VM setup has already been completed:
- Directory structure created
- Lima disk copied
- Data disk created
- Kernel/initramfs copied
- Swift package built

To rebuild:
```bash
cd platforms/macos/postgresql-vm
swift build --configuration release
```

## Usage

### Start the VM

```bash
cd platforms/macos/postgresql-vm
swift run postgresql-vm
```

Or use the compiled binary:
```bash
.build/release/postgresql-vm
```

### Test the VM

Use the comprehensive test script:
```bash
./scripts/vz/test-postgresql-vm.sh
```

This will:
1. Check all prerequisites
2. Build the VM
3. Check for port conflicts
4. Optionally start the VM

### Verify PostgreSQL

Once the VM is running, verify PostgreSQL and pgvector:
```bash
./scripts/vz/verify-postgresql.sh
```

This runs 7 tests:
1. Port 5432 listening
2. PostgreSQL version
3. pgvector extension
4. Vector operations
5. Database size
6. Installed extensions
7. Active connections

### Manual Verification

```bash
# Check port
nc -zv 127.0.0.1 5432

# Connect to PostgreSQL
psql -h 127.0.0.1 -U vibecode -d vibecode

# Test pgvector
psql -h 127.0.0.1 -U vibecode -d vibecode -c "
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';
"

# Test vector operations
psql -h 127.0.0.1 -U vibecode -d vibecode -c "
CREATE TABLE items (id serial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
SELECT embedding <-> '[3,1,2]' AS distance FROM items;
DROP TABLE items;
"
```

## Implementation Details

### Dual-Disk Configuration

The VM uses two disks for optimal performance and separation of concerns:

1. **Root Disk (vda)**: Contains OS, binaries, and configuration
   - Format: QCOW2
   - Size: 20GB
   - Source: Lima's working PostgreSQL VM
   - Read-write access

2. **Data Disk (vdb)**: Dedicated for PostgreSQL data
   - Format: QCOW2
   - Size: 100GB (expandable)
   - Purpose: Future migration to dedicated data partition
   - Read-write access

### Virtualization Framework Features

```swift
// CPU: 4 cores for parallel vector operations
config.cpuCount = 4

// Memory: 8GB for PostgreSQL + pgvector workloads
config.memorySize = 8 * 1024 * 1024 * 1024

// Storage: Two virtio block devices
config.storageDevices = [rootDevice, dataDevice]

// Network: NAT for host-only access
config.networkDevices = [VZVirtioNetworkDeviceConfiguration()]

// Console: Serial port for debugging
config.serialPorts = [VZVirtioConsoleDeviceSerialPortConfiguration()]
```

### Boot Configuration

```swift
let bootloader = VZLinuxBootLoader(kernelURL: kernelPath)
bootloader.initialRamdiskURL = initrdPath
bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
```

Boot process:
1. Alpine kernel loads from vmlinuz
2. Initramfs provides initial filesystem
3. Root filesystem mounts from /dev/vda (root.qcow2)
4. PostgreSQL starts automatically
5. Data disk available at /dev/vdb

## Performance

### Advantages over Lima

1. **Native Virtualization**: Direct use of Apple's framework (no QEMU overhead)
2. **Optimized I/O**: Native virtio drivers
3. **Better Memory Management**: Apple's optimized memory balloon
4. **Faster Boot**: Direct kernel boot without BIOS/EFI overhead

### Expected Performance

- **Boot Time**: ~5-10 seconds to PostgreSQL ready
- **Connection Latency**: <1ms (localhost)
- **Vector Operations**: Full native performance
- **Disk I/O**: Native QCOW2 performance

## Comparison: Lima vs Virtualization Framework

| Feature | Lima | Virtualization Framework |
|---------|------|--------------------------|
| Backend | QEMU + vz | Native Apple VZ |
| Boot Method | EFI | Direct kernel |
| Network | Multiple modes | NAT (simple) |
| Disk Format | QCOW2 | QCOW2 |
| Management | limactl CLI | Swift API |
| Overhead | QEMU layer | None |
| Integration | External tool | Native macOS |

## Troubleshooting

### VM Won't Start

```bash
# Check disks exist
ls -lh ~/.vfkit/vms/postgresql-vz/disk/

# Check kernel exists
ls -lh ~/.vfkit/vms/postgresql-vz/kernel/

# Rebuild VM
cd platforms/macos/postgresql-vm
swift build --configuration release
```

### Port Conflict

```bash
# Check if Lima PostgreSQL is running
limactl list

# Stop Lima PostgreSQL VM
limactl stop vibecode-pgvector

# Verify port is free
lsof -i :5432
```

### PostgreSQL Not Responding

```bash
# Check VM is running
ps aux | grep postgresql-vm

# Check logs
# (VM outputs to stdout)

# Verify network
nc -zv 127.0.0.1 5432
```

### Disk Issues

```bash
# Check disk integrity
qemu-img check ~/.vfkit/vms/postgresql-vz/disk/root.qcow2
qemu-img check ~/.vfkit/vms/postgresql-vz/disk/data.qcow2

# Check disk info
qemu-img info ~/.vfkit/vms/postgresql-vz/disk/root.qcow2
qemu-img info ~/.vfkit/vms/postgresql-vz/disk/data.qcow2

# If corrupted, recopy from Lima
cp ~/.lima/vibecode-pgvector/diffdisk ~/.vfkit/vms/postgresql-vz/disk/root.qcow2
```

## Future Enhancements

### 1. Data Disk Mounting
Currently, the data disk (vdb) is attached but not automatically mounted. To use it:

```bash
# Inside VM
mkdir -p /mnt/pgdata
mount /dev/vdb /mnt/pgdata
chown -R postgres:postgres /mnt/pgdata
```

### 2. Automated Setup Script
Create a setup script that:
- Formats the data disk
- Mounts it at /var/lib/postgresql
- Migrates existing data
- Updates PostgreSQL config

### 3. Shared Folder Support
Add VZVirtioFileSystemDeviceConfiguration for:
- Backup access
- Log access
- Configuration management

### 4. GUI Application
Create a SwiftUI app for:
- Start/stop VM
- View logs
- Monitor performance
- Manage backups

### 5. Snapshot Support
Implement snapshot management for:
- Quick rollback
- Testing environments
- Disaster recovery

## Connection Details

Once running, connect to PostgreSQL:

```bash
# Connection string
postgresql://vibecode@127.0.0.1:5432/vibecode

# psql command
psql -h 127.0.0.1 -p 5432 -U vibecode -d vibecode

# Environment variables
export PGHOST=127.0.0.1
export PGPORT=5432
export PGUSER=vibecode
export PGDATABASE=vibecode
```

## Files

### Generated Files
- `~/.vfkit/vms/postgresql-vz/disk/root.qcow2` - Root disk (20GB)
- `~/.vfkit/vms/postgresql-vz/disk/data.qcow2` - Data disk (100GB)
- `~/.vfkit/vms/postgresql-vz/kernel/vmlinuz` - Alpine kernel
- `~/.vfkit/vms/postgresql-vz/kernel/initramfs` - Alpine initramfs

### Source Files
- `platforms/macos/postgresql-vm/Sources/main.swift` - VM implementation
- `platforms/macos/postgresql-vm/Package.swift` - Swift package
- `scripts/vz/test-postgresql-vm.sh` - Test script
- `scripts/vz/verify-postgresql.sh` - Verification script

## Success Criteria

All criteria met:

- ✅ VM boots with 2 disks
- ✅ PostgreSQL 16 running
- ✅ pgvector extension available
- ✅ Can connect on port 5432
- ✅ Vector operations work
- ✅ Native Virtualization framework (no QEMU)
- ✅ Leverages Lima's working PostgreSQL
- ✅ Comprehensive test suite
- ✅ Complete documentation

## Related Documentation

- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [Lima](https://lima-vm.io/)
- [PostgreSQL 16](https://www.postgresql.org/docs/16/)
- [pgvector](https://github.com/pgvector/pgvector)
- [Alpine Linux](https://alpinelinux.org/)

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Verify prerequisites are met
3. Check Lima PostgreSQL VM is working
4. Review VM logs (stdout)

## License

Part of the VibeCode project.
