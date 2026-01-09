# Volume Mounting - Quick Start Guide

## 5-Minute Setup

### 1. Create Shared Directory
```bash
mkdir -p ~/vm-shared
```

### 2. Launch VM
```bash
vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel ./azure/linux-kernel-arm64 \
  --initrd ./azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat \
  --device virtio-serial,logFilePath=/tmp/vm.log \
  --device virtio-rng \
  --device virtio-fs,sharedDir=$HOME/vm-shared,mountTag=hostshare
```

### 3. Access Shared Files
**In VM:**
```bash
ls /mnt/host/              # View shared files
echo "test" > /mnt/host/test.txt
```

**On Host:**
```bash
cat ~/vm-shared/test.txt   # Read file from VM
```

## Common Use Cases

### Persist PostgreSQL Data
```bash
# On host
mkdir -p ~/vm-shared/postgresql

# Launch VM (same command as above)
# PostgreSQL automatically uses /mnt/host/postgresql
# Data persists across VM restarts!
```

### Persist Valkey/Redis Data
```bash
# On host
mkdir -p ~/vm-shared/valkey

# Launch VM
# Valkey automatically uses /mnt/host/valkey
```

### Application Configuration
```bash
# On host
cat > ~/vm-shared/config/app.conf << EOF
database_url=postgresql://localhost:5432/mydb
redis_url=redis://localhost:6379
EOF

# In VM
cat /mnt/host/config/app.conf
```

## Directory Structure

**In VM:**
- `/mnt/host/` - Main shared directory
- `/mnt/config/` - Shortcut to config files
- `/mnt/data/` - Shortcut to data files
- `/mnt/logs/` - Shortcut to log files

**On Host:**
- `~/vm-shared/` - Maps to /mnt/host/ in VM

## Testing

### Quick Test
```bash
# On host
echo "Hello from host" > ~/vm-shared/test.txt

# In VM (SSH: ssh root@<VM_IP>)
cat /mnt/host/test.txt
# Should show: "Hello from host"
```

### Run Full Test Suite
```bash
./azure/test-volume-mounting.sh
```

## Troubleshooting

**Not mounted?**
```bash
# In VM
mount | grep virtiofs
# Should show: hostshare on /mnt/host type virtiofs
```

**Files not appearing?**
```bash
# Check host directory
ls -la ~/vm-shared

# Check VM mount
ls -la /mnt/host
```

## Need More Help?

See full documentation: `VOLUME-MOUNTING-GUIDE.md`

Or run the example script: `./azure/test-unified-vm-boot.sh`
