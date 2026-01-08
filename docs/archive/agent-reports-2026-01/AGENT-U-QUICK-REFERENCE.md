# Agent U Quick Reference - PostgreSQL Shared Memory Fix

## Problem
PostgreSQL failed with: `FATAL: could not open shared memory segment "/PostgreSQL.2161619594": No such file or directory`

## Root Cause
Missing `/dev/shm` tmpfs mount (required for POSIX shared memory)

## Solution Location
**File**: `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`
**Lines**: 1081-1094

## Boot Sequence with Fix

```
VM Boot
  |
  +-- Kernel loads
  |
  +-- Init script starts (/init)
  |
  +-- Mount basic filesystems (proc, sys, dev)
  |
  +-- Create device nodes
  |
  +-- [NEW] Mount /dev/shm (256MB tmpfs) <-- FIX HAPPENS HERE
  |     "✓ /dev/shm mounted (256M)"
  |
  +-- Load kernel modules (virtio_net, etc.)
  |
  +-- Network setup (DHCP/Static IP)
  |
  +-- Prepare service directories
  |     - Generate SSH keys
  |     - Create PostgreSQL directories
  |     - Initialize PostgreSQL database (initdb) <-- Uses /dev/shm
  |
  +-- Launch services in parallel
  |     - SSH (PID 206)
  |     - Valkey (PID 207)
  |     - PostgreSQL (PID 208) <-- Uses /dev/shm for shared memory
  |     - OpenVSCode (PID 209)
  |
  +-- Service verification
  |
  +-- Ready (shell prompt)
```

## Verification

### Quick Check
```bash
cd /Users/ryan.maclean/vibecode-webgui/azure
./test-unified-vm-boot.sh

# In another terminal:
grep "/dev/shm" /tmp/unified-vm-console.log
# Expected: "✓ /dev/shm mounted (256M)"

grep "PostgreSQL" /tmp/unified-vm-console.log  
# Expected: "✓ PostgreSQL running (PID: 208)"
```

### What to Look For
✅ **Success indicators**:
- `✓ /dev/shm mounted (256M)`
- `✓ Database initialized`
- `✓ PostgreSQL running (PID: xxx)`

❌ **Failure indicators** (should NOT appear):
- `could not open shared memory segment`
- `FATAL:` (related to shared memory)
- `Failed to mount /dev/shm`

## Key Implementation Details

| Aspect | Value |
|--------|-------|
| Mount point | `/dev/shm` |
| Filesystem type | tmpfs (memory-backed) |
| Size | 256MB |
| When mounted | Early in init, before service startup |
| Who uses it | PostgreSQL (primary), potentially other services |

## Code Snippet

```bash
# Mount tmpfs for shared memory (required for PostgreSQL)
echo "=== Setting up shared memory ==="
if ! grep -q "tmpfs /dev/shm" /proc/mounts; then
    mkdir -p /dev/shm
    if mount -t tmpfs -o size=256M tmpfs /dev/shm; then
        echo "✓ /dev/shm mounted (256M)"
    else
        echo "⚠ Failed to mount /dev/shm, PostgreSQL may fail"
    fi
else
    echo "✓ /dev/shm already mounted"
fi
```

## Status
✅ **VERIFIED WORKING** - No action needed

## Related Agents
- **Agent O**: Originally implemented this fix
- **Agent M**: Fixed PostgreSQL user switching
- **Agent T**: Added ICU locale support
- **Agent U**: Verified the fix (this report)
