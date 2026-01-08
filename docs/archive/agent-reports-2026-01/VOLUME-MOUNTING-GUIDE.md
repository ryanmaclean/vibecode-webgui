# Volume Mounting Guide

This guide explains how to mount local directories into the VibeCode VM for configuration files, persistent data storage, and custom directories.

## Overview

The VM uses **VirtioFS** (virtio-fs) for high-performance file system sharing between the host and VM. This provides:

- **Native file system performance** - Near-native speed with minimal overhead
- **Automatic synchronization** - Changes on host immediately visible in VM
- **Seamless integration** - Works with standard POSIX file operations
- **Security** - Isolated namespace with configurable permissions

## Quick Start

### 1. Create a Shared Directory on Host

```bash
# Create a directory to share with the VM
mkdir -p ~/vm-shared

# Add some example files
echo "database_url=postgresql://localhost:5432/mydb" > ~/vm-shared/app.conf
mkdir -p ~/vm-shared/postgresql
mkdir -p ~/vm-shared/valkey
```

### 2. Launch VM with Volume Mount

Add the `--device virtio-fs` option to your vfkit command:

```bash
vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel /path/to/linux-kernel-arm64 \
  --initrd /path/to/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=/tmp/vm-console.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=$HOME/vm-shared,mountTag=hostshare
```

**Key Parameters:**
- `sharedDir=/path/on/host` - The host directory to share
- `mountTag=hostshare` - Internal tag for mounting (must match VM configuration)

### 3. Access Files in VM

The shared directory is automatically mounted at `/mnt/host/`:

```bash
# SSH into the VM
ssh root@<VM_IP>

# List shared files
ls -la /mnt/host/

# Read configuration
cat /mnt/host/app.conf

# Write data
echo "test data" > /mnt/host/test.txt
```

## Directory Structure

The VM automatically creates these mount points:

```
/mnt/host/          # Main shared directory (maps to your host directory)
/mnt/host/config/   # For configuration files
/mnt/host/data/     # For persistent data
/mnt/host/logs/     # For log files

# Convenience symlinks
/mnt/config -> /mnt/host/config
/mnt/data -> /mnt/host/data
/mnt/logs -> /mnt/host/logs
```

## Use Cases

### 1. PostgreSQL Persistent Storage

Store PostgreSQL data on the host for persistence across VM restarts:

```bash
# On host: Create PostgreSQL data directory
mkdir -p ~/vm-shared/postgresql

# Launch VM with shared directory
vfkit ... --device virtio-fs,sharedDir=$HOME/vm-shared,mountTag=hostshare

# In VM: PostgreSQL will automatically detect and use /mnt/host/postgresql
# Data persists even after VM restart!
```

The init script automatically detects `/mnt/host/postgresql/` and uses it instead of the ephemeral `/var/lib/postgresql/data`.

### 2. Valkey (Redis) Persistent Storage

```bash
# On host: Create Valkey data directory
mkdir -p ~/vm-shared/valkey

# In VM: Valkey will automatically detect and use /mnt/host/valkey
# RDB snapshots persist across restarts
```

### 3. Application Configuration

```bash
# On host: Create configuration files
cat > ~/vm-shared/config/database.conf << EOF
host=localhost
port=5432
user=myapp
database=myapp_db
EOF

# In VM: Read configuration
cat /mnt/config/database.conf
# or: cat /mnt/host/config/database.conf
```

### 4. Custom Application Data

```bash
# On host: Add application files
cp -r ./my-app ~/vm-shared/apps/my-app

# In VM: Access and run
cd /mnt/host/apps/my-app
./run.sh
```

### 5. Log File Access

```bash
# In VM: Write logs to shared directory
echo "Application started" >> /mnt/logs/app.log

# On host: Monitor logs in real-time
tail -f ~/vm-shared/logs/app.log
```

## Advanced Usage

### Multiple Shared Directories

You can mount multiple directories by adding multiple virtio-fs devices:

```bash
vfkit \
  ... \
  --device virtio-fs,sharedDir=$HOME/configs,mountTag=configs \
  --device virtio-fs,sharedDir=$HOME/data,mountTag=datastore \
  --device virtio-fs,sharedDir=/var/log/myapp,mountTag=logs
```

Then in the VM, mount them manually:

```bash
mkdir -p /mnt/configs /mnt/datastore /mnt/logs
mount -t virtiofs configs /mnt/configs
mount -t virtiofs datastore /mnt/datastore
mount -t virtiofs logs /mnt/logs
```

### Read-Only Mounts

VirtioFS doesn't directly support read-only at the device level, but you can remount:

```bash
# In VM
mount -o remount,ro /mnt/host
```

### Permissions and Ownership

Files maintain their host permissions and ownership:

```bash
# On host
echo "secret" > ~/vm-shared/secret.txt
chmod 600 ~/vm-shared/secret.txt

# In VM - same permissions
ls -l /mnt/host/secret.txt
# -rw------- 1 root root 7 Jan 5 12:00 secret.txt
```

**Important:** The VM runs as root by default. Files created in the VM will be owned by root on the host.

### Custom Mount Points

If you need custom mount points, modify your VM's init script or add mount commands:

```bash
# In VM
mkdir -p /opt/app/config
mount --bind /mnt/host/config/app.conf /opt/app/config/app.conf
```

## Best Practices

### 1. Directory Organization

Organize your shared directory for clarity:

```
~/vm-shared/
├── config/           # Configuration files
│   ├── app.conf
│   ├── database.conf
│   └── secrets.env
├── data/            # Application data
│   ├── postgresql/  # PostgreSQL data
│   ├── valkey/      # Valkey/Redis data
│   └── uploads/     # User uploads
├── logs/            # Log files
│   ├── app.log
│   ├── postgresql.log
│   └── valkey.log
└── README.txt       # Documentation
```

### 2. Backup Strategy

Since data is on the host, regular backups are straightforward:

```bash
# Backup PostgreSQL data
tar czf postgresql-backup-$(date +%Y%m%d).tar.gz ~/vm-shared/data/postgresql/

# Backup all VM data
rsync -av ~/vm-shared/ /backup/vm-data/
```

### 3. Performance Considerations

- **VirtioFS is fast**: Near-native performance for most workloads
- **Large files**: Works well with databases and large files
- **Many small files**: Some overhead with thousands of small files
- **Network shares**: Don't use network mounts (NFS/SMB) as the shared directory

### 4. Security Considerations

**Isolation:**
- The VM can read/write any files in the shared directory
- Don't share sensitive host directories (like `/etc` or `~/.ssh`)

**Secrets Management:**
```bash
# Bad: Don't put secrets directly in shared files
echo "password=secret123" > ~/vm-shared/config.txt

# Good: Use environment variables or secret management
# Pass via kernel command line or use a proper secrets manager
```

**File Permissions:**
```bash
# Set restrictive permissions on sensitive files
chmod 600 ~/vm-shared/config/secrets.env
chmod 700 ~/vm-shared/data/postgresql
```

### 5. Troubleshooting

**Mount not working:**

```bash
# Check if virtio-fs device is configured
vfkit ... --device virtio-fs,sharedDir=/path,mountTag=hostshare

# In VM: Check if mount succeeded
mount | grep virtiofs
# Should show: hostshare on /mnt/host type virtiofs

# If not mounted, mount manually
mount -t virtiofs hostshare /mnt/host

# Check dmesg for errors
dmesg | grep virtiofs
```

**Permission denied errors:**

```bash
# Check host directory permissions
ls -ld ~/vm-shared
# Should be readable/writable

# Check SELinux/AppArmor (if applicable)
# May need to configure security contexts
```

**Files not appearing:**

```bash
# Files should appear immediately, but check:
# 1. Correct shared directory
ls ~/vm-shared

# 2. In VM
ls /mnt/host

# 3. Host changes should be immediate
# On host: touch ~/vm-shared/test
# In VM: ls /mnt/host/test  # Should appear instantly
```

## Testing Volume Mounts

Use the provided test script:

```bash
# Run the test script
./azure/test-unified-vm-boot.sh

# The script automatically:
# 1. Creates /tmp/vm-shared-storage
# 2. Adds a README.txt file
# 3. Mounts it as /mnt/host in the VM

# After VM boots, SSH in and verify:
ssh root@<VM_IP>
cat /mnt/host/README.txt
echo "test from VM" > /mnt/host/test.txt
exit

# Back on host, verify the file:
cat /tmp/vm-shared-storage/test.txt
```

## Example Configurations

### Development Environment

```bash
# Share your code and data
vfkit \
  --cpus 4 \
  --memory 4096 \
  --kernel ./linux-kernel-arm64 \
  --initrd ./unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat \
  --device virtio-serial,logFilePath=/tmp/vm.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=$HOME/projects,mountTag=hostshare
```

Access your code at `/mnt/host/` in the VM.

### Production-Like Setup

```bash
# Separate data, config, and logs
mkdir -p ~/vm-data/{config,data,logs}

vfkit \
  --cpus 8 \
  --memory 8192 \
  --kernel ./linux-kernel-arm64 \
  --initrd ./unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat \
  --device virtio-serial,logFilePath=/tmp/vm.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=$HOME/vm-data,mountTag=hostshare
```

### Database Development

```bash
# Dedicated database storage
mkdir -p ~/databases/{postgresql,valkey}

vfkit \
  --cpus 4 \
  --memory 4096 \
  --kernel ./linux-kernel-arm64 \
  --initrd ./unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat \
  --device virtio-serial,logFilePath=/tmp/vm.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=$HOME/databases,mountTag=hostshare
```

PostgreSQL and Valkey will automatically use persistent storage.

## Integration with Build Process

To rebuild the VM with volume mounting support:

```bash
# Rebuild the initramfs with updated init script
cd azure
./build-unified-services-with-datadog.sh

# The new initramfs includes:
# - Automatic /mnt/host mounting
# - PostgreSQL persistent storage detection
# - Valkey persistent storage detection
# - Convenience symlinks
```

## FAQ

**Q: Does the VM need to be restarted to see host changes?**

A: No, changes are immediately visible due to VirtioFS's shared memory design.

**Q: Can I use this with Docker volumes or network shares?**

A: Not recommended. VirtioFS expects a real filesystem. Use a local directory and sync to network storage if needed.

**Q: What happens if the host directory is deleted while VM is running?**

A: Files will disappear from the VM immediately. Services using those files may error.

**Q: Can I nest VirtioFS mounts?**

A: Yes, but performance may degrade. Better to mount directories at the same level.

**Q: Does this work with all file systems?**

A: Yes, VirtioFS works with any host filesystem (ext4, APFS, NTFS, etc.).

**Q: How much overhead does VirtioFS add?**

A: Minimal - typically 5-10% for sequential I/O, less than 1% for random I/O compared to native disk.

## Further Reading

- [VirtioFS Documentation](https://virtio-fs.gitlab.io/)
- [vfkit Documentation](https://github.com/crc-org/vfkit)
- [Linux VirtioFS Driver](https://www.kernel.org/doc/html/latest/filesystems/virtiofs.html)

## Support

For issues or questions:

1. Check the VM console log: `tail -f /tmp/unified-vm-console.log`
2. SSH into VM and check: `mount | grep virtiofs`
3. Review this guide's troubleshooting section
4. Check the VM init script for mount logic

---

**Last Updated:** 2026-01-05 by Agent Z
