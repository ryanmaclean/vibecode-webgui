# Unified VM Quick Start Guide

**Status:** Partial Success - SSH and OpenVSCode Internal Working

## Launch the VM

```bash
open ~/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app
```

Wait 35 seconds for boot.

## Check Console Logs

```bash
tail -f /tmp/vibecode-console-*.log
```

Look for these success messages:
```
✓ Network configured: 192.168.64.3/24
✓ Dropbear SSH server started
✓ OpenVSCode internal server: 127.0.0.1:3000
✓ TCP relay configured: 0.0.0.0:8080 -> 127.0.0.1:3000
```

## Access Working Services

### SSH Terminal (✅ WORKING)

```bash
ssh root@192.168.64.3
# Password: vibecode
```

Once connected, you can:
```bash
ps aux                    # See running processes
ip addr show              # Check network configuration
netstat -tlnp             # See listening ports
/opt/valkey/bin/valkey-server --version   # Test Valkey binary
```

### OpenVSCode Internal (⚠️ PARTIAL)

The server runs internally but external access has issues:

**Internal (should work):**
```bash
open http://localhost:3000?tkn=b642e4a1-581c-4363-a9cc-33b746880f2b
```

**External (currently not working):**
```bash
open http://192.168.64.3:8080
# Connection refused - TCP relay issue
```

## Services Not Working

### Valkey Redis Cache (❌ NOT STARTED)

**Expected but not working:**
```bash
redis-cli -h 192.168.64.3
# Connection refused
```

**Debug via SSH:**
```bash
ssh root@192.168.64.3
ps aux | grep valkey       # Check if running
/opt/valkey/bin/valkey-server /etc/valkey/valkey.conf   # Try manual start
```

### PostgreSQL Database (❌ FAILED)

**Expected but not working:**
```bash
psql -h 192.168.64.3 -U postgres
# Connection refused
```

**Known Issue:**
PostgreSQL binary has 33 missing SSL symbols due to Alpine/Ubuntu library mismatch.

**Error in console:**
```
Error relocating /usr/bin/postgres: SSL_CTX_get_cert_store: symbol not found
Error relocating /usr/bin/postgres: SSL_load_client_CA_file: symbol not found
[... 31 more SSL errors ...]
⚠ PostgreSQL failed to start - check library dependencies
```

## Troubleshooting

### VM Won't Boot
```bash
# Check kernel exists
ls -lh ~/Downloads/vmlinuz-5.15.0-161-generic

# Check initramfs
ls -lh ~/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app/Contents/Resources/*.cpio.gz
```

### Network Issues
```bash
# Verify DHCP assigned correct IP
ssh root@192.168.64.3 'ip addr show'

# Should show:
# inet 192.168.64.3/24 brd 192.168.64.255 scope global eth0
```

### Service Not Starting

**Check console logs:**
```bash
grep -E "(Starting|✓|✗|ERROR)" /tmp/vibecode-console-*.log
```

**SSH into VM and check manually:**
```bash
ssh root@192.168.64.3
ps aux                           # See what's running
netstat -tlnp                    # See listening ports
dmesg | tail                     # Check kernel messages
ls -la /opt/valkey/bin/          # Verify binaries exist
ls -la /usr/bin/postgres         # Verify postgres binary
```

## What's Working vs Not Working

| Feature | Status | Notes |
|---------|--------|-------|
| VM Boot | ✅ Working | ~35 seconds |
| Network | ✅ Working | 192.168.64.3/24 |
| Console Logs | ✅ Working | /tmp/vibecode-console-*.log |
| SSH (Dropbear) | ✅ Working | Port 22, password: vibecode |
| OpenVSCode Internal | ✅ Working | localhost:3000 |
| OpenVSCode External | ❌ Not Working | 192.168.64.3:8080 connection refused |
| Valkey | ❌ Not Working | Port 6379 not listening |
| PostgreSQL | ❌ Not Working | Missing SSL symbols, failed to start |

## Next Steps to Fix

### Fix OpenVSCode External Access
```bash
# SSH into VM
ssh root@192.168.64.3

# Check if Bun relay is listening
netstat -tlnp | grep 8080

# If not, check Bun process
ps aux | grep bun

# Try to access internally
curl http://127.0.0.1:3000

# Test relay manually
# (Need to rebuild init script with better relay implementation)
```

### Fix Valkey
```bash
# SSH into VM
ssh root@192.168.64.3

# Try manual start
/opt/valkey/bin/valkey-server --version
/opt/valkey/bin/valkey-server /etc/valkey/valkey.conf

# Check for errors
tail /var/log/valkey.log
```

### Fix PostgreSQL
PostgreSQL needs complete rebuild with Ubuntu libraries or Alpine libraries (no mixing).

**Option 1: Use Alpine PostgreSQL**
```bash
# Get Alpine ARM64 PostgreSQL package
apk fetch postgresql --arch aarch64

# Extract and add to initramfs
tar xf postgresql-*.apk
# Copy to initramfs and rebuild
```

**Option 2: Use Complete Ubuntu Stack**
```bash
# Add all Ubuntu libraries including OpenSSL
# Download from Ubuntu ARM64 repos
# Rebuild initramfs with consistent library set
```

## Files and Locations

**Application:**
```
~/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app
```

**Initramfs:**
```
~/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz
(174MB)
```

**Kernel:**
```
~/Downloads/vmlinuz-5.15.0-161-generic
```

**Console Logs:**
```
/tmp/vibecode-console-*.log
```

**Source Initramfs:**
```
~/vibecode-webgui/azure/unified-services-complete.cpio.gz
```

## Additional Resources

- **Full Status:** `~/vibecode-webgui/docs/VM_REBUILD_STATUS.md`
- **Architecture Plan:** `~/vibecode-webgui/docs/SPECIALIZED_VM_REBUILD_PLAN.md`
- **Access Methods:** `~/vibecode-webgui/docs/VM_ACCESS.md`
- **Build Scripts:** `~/vibecode-webgui/scripts/rebuild-specialized-vms.sh`

## Success Rate

**Current Status:** 50% Operational
- ✅ SSH Server: Fully working
- ⚠️ OpenVSCode: Internal working, external needs fix
- ❌ Valkey: Not started (needs debugging)
- ❌ PostgreSQL: Failed (needs library rebuild)

**Goal:** 100% Operational (all 4 services working)
**Remaining Work:** Fix TCP relay, debug Valkey, rebuild PostgreSQL with compatible libraries
