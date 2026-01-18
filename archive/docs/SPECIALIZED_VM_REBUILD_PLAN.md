# Specialized VM Rebuild Plan

**Date:** November 26, 2025
**Goal:** Rebuild all specialized VMs using the proven complete initramfs pattern from BasicVibeCode

---

## Current Working Pattern (BasicVibeCode)

### What Works ✅
- **Kernel:** Ubuntu 5.15.0-161-generic with virtio modules
- **Initramfs:** `bun-openvscode-complete.cpio.gz` (109MB)
- **Components:**
  - virtio_net kernel module (network driver)
  - TCP relay (0.0.0.0:8080 → 127.0.0.1:3000)
  - VSOCK support (localhost:3000 from host)
  - OpenVSCode Server on port 3000
  - BusyBox utilities
- **Access Methods:**
  - ✅ Direct TCP: `http://192.168.64.3:8080` (VERIFIED)
  - ✅ Localhost VSOCK: `http://localhost:3000` (VERIFIED)
  - ⏳ SSH Tunnel: Port 22 (GLIBC issue, pending fix)

---

## Specialized VMs Inventory

### 1. Valkey VM (Redis Alternative)
- **Current Location:** `dist/vm-images/vibecode-valkey.img` (50GB)
- **Service:** Valkey/Redis server
- **Port:** 6379
- **Required Components:**
  - Valkey binary (Redis-compatible)
  - Network modules (virtio_net)
  - Configuration: Listen on 0.0.0.0:6379
- **Access Methods Needed:**
  - Direct TCP: `redis-cli -h 192.168.64.3 -p 6379`
  - VSOCK: `redis-cli -h localhost -p 6379` (with port forward)
- **Cloud-init Config:** `config/cloud-init/valkey-user-data.yaml`

### 2. PostgreSQL VM
- **Current Location:** `dist/vm-images/vibecode-postgresql.img` (50GB)
- **Service:** PostgreSQL 15+
- **Port:** 5432
- **Required Components:**
  - PostgreSQL binaries (psql, postgres, initdb)
  - Network modules (virtio_net)
  - Configuration: Listen on 0.0.0.0:5432, auth via md5
  - Initial database: vibecode
  - User: postgres / Password: postgres
- **Access Methods Needed:**
  - Direct TCP: `psql -h 192.168.64.3 -U postgres -d vibecode`
  - VSOCK: `psql -h localhost -U postgres -d vibecode` (with port forward)
- **Cloud-init Config:** `config/cloud-init/postgresql-user-data.yaml`

### 3. PostgreSQL + pgvector VM
- **Current Location:** `dist/vm-images/vibecode-pgvector.img` (20GB)
- **Service:** PostgreSQL with pgvector extension
- **Port:** 5432
- **Required Components:**
  - PostgreSQL + pgvector extension
  - Network modules (virtio_net)
  - Configuration: Same as PostgreSQL + pgvector loaded
- **Access Methods Needed:**
  - Same as PostgreSQL VM

### 4. Node.js VM
- **Current Location:** `dist/vm-images/vibecode-nodejs.img` (50GB)
- **Service:** Node.js runtime with test server
- **Port:** 3000 (test server)
- **Required Components:**
  - Node.js runtime (latest LTS)
  - npm/npx
  - Network modules (virtio_net)
- **Access Methods Needed:**
  - Direct TCP: `curl http://192.168.64.3:3000`
  - VSOCK: `curl http://localhost:3000`
- **Cloud-init Config:** `config/cloud-init/nodejs-user-data.yaml`

### 5. Node.js + Code-Server VM
- **Current Location:** `dist/vm-images/vibecode-nodejs-codeserver.img` (50GB)
- **Service:** Node.js + OpenVSCode Server
- **Port:** 8080 (OpenVSCode)
- **Required Components:**
  - Node.js runtime
  - OpenVSCode Server
  - Network modules (virtio_net)
  - TCP relay (8080 → 3000)
- **Access Methods Needed:**
  - Direct TCP: `http://192.168.64.3:8080`
  - VSOCK: `http://localhost:3000`
- **Cloud-init Config:** `config/cloud-init/codeserver-user-data.yaml`

### 6. IDE VM
- **Current Location:** `dist/vm-images/vibecode-ide.img` (50GB)
- **Service:** Full IDE environment
- **Port:** TBD (likely 8080)
- **Required Components:**
  - IDE server
  - Network modules (virtio_net)
- **Access Methods Needed:**
  - Direct TCP
  - VSOCK

---

## Rebuild Strategy

### Phase 1: Create Base Initramfs Template
**Location:** `/tmp/specialized-vm-base/`

1. Copy working initramfs foundation:
   ```bash
   cp -r /tmp/initramfs-with-virtio /tmp/specialized-vm-base
   ```

2. Remove OpenVSCode-specific components:
   ```bash
   rm -rf /tmp/specialized-vm-base/opt/openvscode
   ```

3. Keep essential components:
   - BusyBox utilities
   - Virtio kernel modules
   - Network configuration (DHCP, udhcpc)
   - Base init script

### Phase 2: Build Service-Specific Initramfs

For each specialized service, create a variant:

1. **Valkey Initramfs:**
   ```bash
   cp -r /tmp/specialized-vm-base /tmp/initramfs-valkey
   # Add Valkey binary to /tmp/initramfs-valkey/bin/
   # Add Valkey config to /tmp/initramfs-valkey/etc/
   # Modify init to start Valkey
   ```

2. **PostgreSQL Initramfs:**
   ```bash
   cp -r /tmp/specialized-vm-base /tmp/initramfs-postgresql
   # Add PostgreSQL binaries to /tmp/initramfs-postgresql/usr/bin/
   # Add PostgreSQL libs to /tmp/initramfs-postgresql/usr/lib/
   # Initialize database in init script
   # Modify init to start PostgreSQL
   ```

3. **Node.js Initramfs:**
   ```bash
   cp -r /tmp/specialized-vm-base /tmp/initramfs-nodejs
   # Add Node.js binary to /tmp/initramfs-nodejs/usr/bin/
   # Add Node.js libs
   # Modify init to start Node test server
   ```

### Phase 3: Modify Init Scripts

Each specialized VM needs a modified `/init` script:

**Example for Valkey:**
```bash
#!/bin/ash

# ... (standard boot sequence from BasicVibeCode)

# Load network modules
insmod /lib/modules/virtio_net.ko
insmod /lib/modules/net_failover.ko
insmod /lib/modules/failover.ko

# Configure network
ip link set dev eth0 up
udhcpc -i eth0

# Start Valkey
echo "Starting Valkey server..."
/bin/valkey-server /etc/valkey.conf &

# Keep running
exec /bin/ash
```

### Phase 4: Package Each Initramfs

For each specialized VM:
```bash
cd /tmp/initramfs-<service>
find . | cpio -o -H newc | gzip > ~/vibecode-webgui/azure/<service>-complete.cpio.gz
```

Expected outputs:
- `valkey-complete.cpio.gz`
- `postgresql-complete.cpio.gz`
- `nodejs-complete.cpio.gz`
- `codeserver-complete.cpio.gz`

### Phase 5: Create App Bundles

Modify `bundle-apps.sh` or create new bundling scripts:

**Example: `bundle-valkey-app.sh`**
```bash
#!/bin/bash
KERNEL="$HOME/Downloads/vmlinuz-5.15.0-161-generic"
INITRD="$HOME/vibecode-webgui/azure/valkey-complete.cpio.gz"

create_bundle "VibeCodeValkey" "ValkeyApp" "com.vibecode.valkey"
```

### Phase 6: Testing Protocol

For each rebuilt VM, test:

1. **Network Connectivity:**
   ```bash
   nc -zv -w 3 192.168.64.3 <service-port>
   ```

2. **Service Functionality:**
   - Valkey: `redis-cli -h 192.168.64.3 PING`
   - PostgreSQL: `psql -h 192.168.64.3 -U postgres -d vibecode -c '\l'`
   - Node.js: `curl http://192.168.64.3:3000`

3. **VSOCK Access (if applicable):**
   ```bash
   nc -zv -w 3 localhost <forwarded-port>
   ```

4. **Console Logs:**
   ```bash
   tail -100 /tmp/vibecode-console-*.log | grep -E "service|port|listening"
   ```

---

## Implementation Order

1. ✅ **BasicVibeCode (OpenVSCode)** - Complete and verified
2. 🔄 **Valkey VM** - Rebuild next (simplest service)
3. 🔄 **PostgreSQL VM** - After Valkey
4. 🔄 **Node.js VM** - After PostgreSQL
5. 🔄 **Node.js + Code-Server VM** - Uses BasicVibeCode pattern
6. 🔄 **pgvector VM** - After PostgreSQL
7. 🔄 **IDE VM** - Last (most complex)

---

## File Locations Reference

### Current Working Files
- Kernel: `~/Downloads/vmlinuz-5.15.0-161-generic`
- Working Initramfs Source: `/tmp/initramfs-with-virtio/`
- Working Initramfs Package: `~/vibecode-webgui/azure/bun-openvscode-complete.cpio.gz`
- Bundle Script: `~/vibecode-webgui/azure/SwiftUI-Apps/bundle-apps.sh`

### Build Scripts
- Main rebuild: `~/vibecode-webgui/scripts/rebuild-all-vms-with-services.sh`
- Cloud-init configs: `~/vibecode-webgui/config/cloud-init/`
- Launch scripts: `~/vibecode-webgui/scripts/initramfs-builder/launch-*.sh`

### Output Locations
- VM Images: `~/vibecode-webgui/dist/vm-images/`
- App Bundles: `~/vibecode-webgui/azure/SwiftUI-Apps/*.app`
- Console Logs: `/tmp/vibecode-console-*.log`

---

## Next Steps

1. Create base initramfs template
2. Build Valkey initramfs as proof-of-concept
3. Test Valkey VM thoroughly
4. Create automation scripts for remaining VMs
5. Document each VM's specific requirements
6. Update UI to support multiple specialized VMs

---

## Success Criteria

Each rebuilt VM must:
- ✅ Boot in under 30 seconds
- ✅ Network interface UP with DHCP
- ✅ Service listening on correct port
- ✅ Accessible via Direct TCP (192.168.64.3:<port>)
- ✅ Accessible via VSOCK (localhost:<port>) if applicable
- ✅ Console logs show successful startup
- ✅ Service responds to basic health checks

---

**Status:** Plan complete, ready for implementation
**Next:** Begin with Valkey VM rebuild
