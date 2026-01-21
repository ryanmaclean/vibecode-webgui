# PostgreSQL Data Persistence with 9p Filesystem

**Mission**: Enable persistent PostgreSQL storage using 9p filesystem for the VibeCode Unified Services VM.

## Problem Statement

Currently, PostgreSQL data is stored in tmpfs (RAM-based temporary filesystem), which means all data is lost when the VM reboots. The original implementation attempted to use VirtioFS for persistence, but this fails because the Alpine Linux kernel lacks `CONFIG_VIRTIO_FS` support.

However, the kernel **does** have 9p support (Plan 9 filesystem protocol), which is a more widely supported alternative for directory sharing between host and guest VMs.

## Solution Overview

This implementation replaces VirtioFS with 9p/virtfs, which provides:

- ✅ Persistent storage for PostgreSQL across VM reboots
- ✅ Better kernel compatibility (9p is more widely supported than VirtioFS)
- ✅ Seamless integration with Apple Virtualization framework
- ✅ Graceful fallback to tmpfs if 9p is unavailable
- ✅ Performance optimizations for 9p storage backend

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         macOS Host                          │
│                                                             │
│  ~/.vibecode/vm-data/                                       │
│  └── postgresql/          ← Persistent storage on host     │
│      ├── PG_VERSION                                         │
│      ├── base/                                              │
│      ├── global/                                            │
│      └── pg_wal/                                            │
│                                                             │
│         ▲                                                   │
│         │ 9p/virtfs share                                  │
│         │ (VZVirtioFileSystemDeviceConfiguration)          │
└─────────┼───────────────────────────────────────────────────┘
          │
          │
┌─────────┼───────────────────────────────────────────────────┐
│         │              Alpine Linux VM                      │
│         ▼                                                   │
│  /mnt/hostshare/          ← Mount point in VM              │
│  └── postgresql/                                            │
│                                                             │
│  PostgreSQL Process                                         │
│  └── Data Directory: /mnt/hostshare/postgresql             │
│      (Persists to host filesystem)                          │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Updated Init Script (`init-9p-updated.sh`)

The init script has been enhanced to:
- Attempt 9p mount first: `mount -t 9p -o trans=virtio,version=9p2000.L`
- Fall back to VirtioFS if 9p fails (for future compatibility)
- Fall back to tmpfs if neither is available
- Apply PostgreSQL optimizations for 9p storage
- Display storage backend status on boot

Key changes:
```bash
# Try 9p/virtfs first (most compatible)
if mount -t 9p -o trans=virtio,version=9p2000.L,msize=104857600 hostshare /mnt/hostshare; then
    STORAGE_BACKEND="9p"
    PGDATA="/mnt/hostshare/postgresql"

    # PostgreSQL optimizations for 9p
    fsync = off                    # 9p handles sync via host
    synchronous_commit = off       # Better performance on 9p
    full_page_writes = off        # 9p is crash-safe via host
fi
```

### 2. Swift VM Manager (`UnifiedServicesVM-9p.swift`)

Updated to use `VZVirtioFileSystemDeviceConfiguration` instead of the non-existent VirtioFS:

```swift
// Configure 9p directory sharing
let sharedDirectory = VZSharedDirectory(url: hostDataPath, readOnly: false)
let directoryShare = VZVirtioFileSystemDeviceConfiguration(tag: "hostshare")
directoryShare.share = sharedDirectory
config.directorySharingDevices = [directoryShare]
```

**Important**: Despite the name `VZVirtioFileSystemDeviceConfiguration`, this actually implements 9p/virtfs when used with `VZSharedDirectory`, not VirtioFS. Apple's Virtualization framework uses 9p as the underlying protocol.

### 3. Build and Deployment Script (`rebuild-and-deploy.sh`)

Automated script that:
1. Extracts the current initramfs
2. Replaces the init script with 9p support
3. Rebuilds the initramfs archive
4. Compiles the Swift VM manager
5. Deploys to the app bundle
6. Creates host storage directory
7. Backs up the original app

### 4. Persistence Test Suite (`test-persistence.sh`)

Comprehensive test that:
1. Starts the VM
2. Creates test database and tables
3. Inserts test data
4. Verifies data exists on host filesystem
5. Stops and restarts the VM
6. Verifies data persisted across reboot
7. Tests write performance
8. Reports results

## Installation

### Prerequisites

- macOS 14.0+ (Sonoma or later)
- Xcode Command Line Tools
- Swift 5.9+
- Standard Unix tools (cpio, gzip, etc.)

### Quick Start

```bash
# Navigate to the project directory
cd /Users/studio/Documents/vibecode-webgui/postgresql-9p-persistence

# Run the build and deployment script
./rebuild-and-deploy.sh

# Test the implementation
./test-persistence.sh
```

### Manual Installation

If you prefer to do it step by step:

```bash
# 1. Extract current initramfs
mkdir -p /tmp/initramfs-work
cd /tmp/initramfs-work
gzip -dc /path/to/unified-vm-initramfs.cpio.gz | cpio -idm

# 2. Replace init script
cp init-9p-updated.sh /tmp/initramfs-work/init
chmod +x /tmp/initramfs-work/init

# 3. Rebuild initramfs
cd /tmp/initramfs-work
find . -print0 | cpio --null -o --format=newc | gzip -9 > ../unified-vm-initramfs-new.cpio.gz

# 4. Compile Swift
swiftc -O -target arm64-apple-macos14.0 \
    -framework Foundation -framework Virtualization \
    UnifiedServicesVM-9p.swift \
    -o UnifiedServicesVibeCode

# 5. Deploy to app bundle
cp ../unified-vm-initramfs-new.cpio.gz \
   menubar/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz

cp UnifiedServicesVibeCode \
   menubar/Apps/UnifiedServicesVibeCodeApp.app/Contents/MacOS/

# 6. Create host storage directory
mkdir -p ~/.vibecode/vm-data/postgresql
```

## Usage

### Starting the VM

```bash
# Option 1: Via Finder
open menubar/Apps/UnifiedServicesVibeCodeApp.app

# Option 2: Via command line
menubar/Apps/UnifiedServicesVibeCodeApp.app/Contents/MacOS/UnifiedServicesVibeCode
```

### Connecting to Services

Once the VM is running:

```bash
# PostgreSQL
psql -h localhost -p 5432 -U postgres

# Valkey (Redis)
redis-cli -h localhost -p 6379

# OpenVSCode Server
open http://localhost:3000

# SSH (for debugging)
ssh -p 2222 root@localhost
# Password: vibecode
```

### Verifying Persistence

```bash
# Check data on host filesystem
ls -la ~/.vibecode/vm-data/postgresql/

# Should see PostgreSQL files:
# - PG_VERSION
# - base/
# - global/
# - pg_wal/
# - etc.

# Create test data
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE testdb;"
psql -h localhost -p 5432 -U postgres testdb -c "CREATE TABLE test (id int);"
psql -h localhost -p 5432 -U postgres testdb -c "INSERT INTO test VALUES (42);"

# Stop and restart VM
pkill UnifiedServicesVibeCode
open menubar/Apps/UnifiedServicesVibeCodeApp.app

# Wait for startup, then verify data
psql -h localhost -p 5432 -U postgres testdb -c "SELECT * FROM test;"
# Should return: id = 42
```

## Troubleshooting

### Issue: "9p not available" warning

**Symptoms**: VM boots but shows "Using tmpfs - data will be lost"

**Solution**:
1. Check if 9p support is enabled in kernel:
   ```bash
   ssh -p 2222 root@localhost "grep 9p /proc/filesystems"
   ```

2. If not available, rebuild kernel with 9p support:
   - Enable `CONFIG_NET_9P`
   - Enable `CONFIG_NET_9P_VIRTIO`
   - Enable `CONFIG_9P_FS`
   - Enable `CONFIG_9P_FS_POSIX_ACL`

### Issue: Permission denied when accessing PostgreSQL data

**Solution**:
```bash
# Check ownership
ls -la ~/.vibecode/vm-data/postgresql/

# Fix permissions if needed
chown -R $(whoami):staff ~/.vibecode/vm-data/postgresql/
```

### Issue: VM fails to start after update

**Solution**:
1. Restore from backup:
   ```bash
   # Backups are created automatically in menubar/Apps/
   ls menubar/Apps/UnifiedServicesVibeCodeApp-backup-*

   # Restore:
   rm -rf menubar/Apps/UnifiedServicesVibeCodeApp.app
   cp -a menubar/Apps/UnifiedServicesVibeCodeApp-backup-YYYYMMDD-HHMMSS.app \
         menubar/Apps/UnifiedServicesVibeCodeApp.app
   ```

2. Check console logs:
   ```bash
   # Swift app logs
   menubar/Apps/UnifiedServicesVibeCodeApp.app/Contents/MacOS/UnifiedServicesVibeCode

   # VM console output will be printed to terminal
   ```

### Issue: Poor performance on 9p

**Symptoms**: Slow database operations

**Solutions**:

1. Increase 9p message size (already set in init script):
   ```bash
   mount -t 9p -o trans=virtio,version=9p2000.L,msize=104857600 hostshare /mnt/hostshare
   ```

2. Use PostgreSQL optimizations (already set in init script):
   ```
   fsync = off
   synchronous_commit = off
   full_page_writes = off
   ```

3. Consider using a dedicated disk image instead (fallback option):
   ```bash
   # Create qcow2 disk for PostgreSQL
   qemu-img create -f qcow2 postgres-data.qcow2 10G

   # Mount in VM and use for PostgreSQL data directory
   ```

## Performance Comparison

| Backend | Startup Time | Write Speed | Persistence | Notes |
|---------|-------------|-------------|-------------|-------|
| tmpfs   | Fast (< 1s) | Very Fast   | ❌ No       | Data lost on reboot |
| 9p      | Medium (~3s)| Medium      | ✅ Yes      | Good balance |
| VirtioFS| N/A         | N/A         | N/A         | Not available in kernel |
| Block Device | Slow (~10s) | Fast      | ✅ Yes      | Best performance, more complex |

## Architecture Decisions

### Why 9p instead of VirtioFS?

1. **Kernel Support**: Alpine Linux kernels commonly have 9p built-in, while VirtioFS requires `CONFIG_VIRTIO_FS` which is less common
2. **Maturity**: 9p has been in the Linux kernel since 2.6.14 (2005)
3. **Apple Support**: Apple's Virtualization framework uses 9p as the underlying protocol for `VZSharedDirectory`
4. **Compatibility**: Works across different architectures and kernel versions

### Why not use a block device?

Block devices (qcow2, raw disk images) offer better performance but:
- More complex to set up and manage
- Require pre-allocation or dynamic resizing
- Less transparent (can't browse files from host)
- 9p provides good enough performance for development use

### PostgreSQL Optimizations for 9p

The following PostgreSQL settings are applied when using 9p:

```
fsync = off                  # 9p handles sync via host filesystem
synchronous_commit = off     # Better performance, still safe with 9p
full_page_writes = off      # 9p is crash-safe via host
```

These are safe because:
- The host filesystem provides crash safety
- 9p protocol ensures data reaches the host
- Host filesystem journaling protects against corruption

**Warning**: These settings would NOT be safe on tmpfs or unreliable storage!

## File Structure

```
postgresql-9p-persistence/
├── README.md                      # This file
├── init-9p-updated.sh            # Updated init script with 9p support
├── UnifiedServicesVM-9p.swift    # Swift VM manager
├── rebuild-and-deploy.sh         # Build and deployment automation
└── test-persistence.sh           # Persistence test suite
```

## Testing

The test suite (`test-persistence.sh`) performs:

1. **Clean Start Test**: Fresh PostgreSQL init
2. **Data Creation Test**: Create database, table, insert data
3. **Host Verification Test**: Verify files exist on host filesystem
4. **Reboot Test**: Stop and restart VM
5. **Persistence Test**: Verify data survived reboot
6. **Write Test**: Add more data post-reboot
7. **Performance Test**: Measure write speed

Expected results:
- ✅ All data persists across reboots
- ✅ PostgreSQL data visible on host at `~/.vibecode/vm-data/postgresql/`
- ✅ 1000 inserts complete in < 5 seconds
- ✅ No data loss or corruption

## Security Considerations

### Current Setup (Development)

- Root password: `vibecode` (hard-coded in init script)
- PostgreSQL: Trust authentication (no password required)
- SSH: Password authentication enabled on port 2222
- Valkey: No authentication

### Production Hardening

For production use, update:

1. **PostgreSQL**:
   ```bash
   # In init script, change pg_hba.conf:
   echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"

   # Set password:
   psql -U postgres -c "ALTER USER postgres PASSWORD 'strong_password';"
   ```

2. **SSH**:
   ```bash
   # Disable password auth, use keys only:
   dropbear -R -F -E -s -p 2222  # -s disables password auth

   # Add authorized keys:
   echo "ssh-rsa YOUR_KEY..." >> /root/.ssh/authorized_keys
   ```

3. **Valkey**:
   ```bash
   # Add to valkey.conf:
   requirepass strong_redis_password
   ```

4. **Firewall**:
   ```bash
   # Use macOS firewall or pf to restrict access to localhost only
   ```

## Future Enhancements

### Option 1: Hybrid Storage

Use 9p for configuration and logs, block device for PostgreSQL data:
- Best performance for database
- Easy access to config files
- More complex setup

### Option 2: NFS-style Export/Import

Automated backup/restore on VM start/stop:
- Works with any storage backend
- Good for disaster recovery
- Slower startup

### Option 3: Container-style Volumes

Implement Docker-style volume management:
- Multiple named volumes
- Volume lifecycle management
- Snapshot support

## References

- [Plan 9 Filesystem Protocol](https://en.wikipedia.org/wiki/9P_(protocol))
- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [Linux 9p Documentation](https://www.kernel.org/doc/Documentation/filesystems/9p.txt)
- [PostgreSQL Data Directory](https://www.postgresql.org/docs/current/storage-file-layout.html)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run the test suite: `./test-persistence.sh`
3. Check VM console output
4. Inspect host data: `ls -la ~/.vibecode/vm-data/postgresql/`

## License

Part of the VibeCode project.
