# Quick Implementation Guide: Fix vfkit Networking

**Based on**: Lima VZ Networking Analysis
**Goal**: Make vfkit networking work using lima's proven approach
**Time**: 30 minutes to 3 hours depending on method

---

## The Problem

vfkit VMs boot but have no `eth0` interface (only `lo` loopback).

**Root Cause**: Minimal initramfs lacks virtio-net kernel driver.

**Network Config**: Already correct! Uses same VZ APIs as lima:
```
VZVirtioNetworkDeviceConfiguration + VZNATNetworkDeviceAttachment
```

---

## Solution Options (Pick One)

### Option 1: Use Lima (FASTEST - 30 minutes)

**Status**: Already working in this project!

**Steps**:

```bash
# 1. Verify lima is installed
brew install lima

# 2. Start VM (config already exists)
limactl start --name=vibecode-valkey /Users/ryan.maclean/vibecode-webgui/config/lima/valkey-vm.yaml

# 3. Verify networking
limactl shell vibecode-valkey
ip addr show eth0  # ✅ eth0 will exist
ping 8.8.8.8       # ✅ Internet works

# 4. Test Valkey
valkey-cli -a VibeCodeChangeMe2025 ping  # ✅ Returns PONG
```

**Pros**:
- ✅ Works immediately
- ✅ YAML configs already created
- ✅ Port forwarding built-in
- ✅ Full VM lifecycle management

**Cons**:
- Additional dependency (lima)
- Can't use vfkit directly

**Integration with Swift**:

```swift
import Foundation

func startLimaVM(name: String, configPath: String) throws {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/limactl")
    process.arguments = ["start", "--name=\(name)", configPath]
    try process.run()
    process.waitUntilExit()
}

// Usage
try startLimaVM(
    name: "vibecode-valkey",
    configPath: "/Users/ryan.maclean/vibecode-webgui/config/lima/valkey-vm.yaml"
)
```

---

### Option 2: Add Modules to Initramfs (MODERATE - 1-2 hours)

Keep vfkit with direct kernel boot, add networking modules.

**Steps**:

```bash
cd /Users/ryan.maclean/vibecode-webgui

# 1. Create workspace
mkdir -p /tmp/vfkit-initramfs-fix
cd /tmp/vfkit-initramfs-fix

# 2. Extract existing initramfs
mkdir initramfs-root
cd initramfs-root
gunzip -c ~/.vfkit/vms/vibecode-alpine/kernel/initramfs | cpio -id

# 3. Download Alpine kernel modules
ALPINE_VERSION="3.22"
KERNEL_VERSION="6.6.63"  # Check with: uname -r in Alpine
wget https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/aarch64/alpine-minirootfs-${ALPINE_VERSION}.0-aarch64.tar.gz

# 4. Extract modules
mkdir alpine-root
tar -xf alpine-minirootfs-*.tar.gz -C alpine-root

# 5. Copy virtio-net modules
mkdir -p lib/modules/${KERNEL_VERSION}/kernel/drivers/net
cp alpine-root/lib/modules/${KERNEL_VERSION}/kernel/drivers/net/virtio_net.ko lib/modules/${KERNEL_VERSION}/kernel/drivers/net/
cp alpine-root/lib/modules/${KERNEL_VERSION}/kernel/drivers/net/net_failover.ko lib/modules/${KERNEL_VERSION}/kernel/drivers/net/
cp alpine-root/lib/modules/${KERNEL_VERSION}/kernel/net/core/failover.ko lib/modules/${KERNEL_VERSION}/kernel/net/core/

# 6. Update init script to load module
cat >> init <<'EOF'

# Load virtio-net driver
echo "Loading virtio-net driver..."
/sbin/modprobe virtio_net

# Bring up eth0
echo "Configuring eth0..."
ip link set eth0 up

# Get IP via DHCP
echo "Running DHCP..."
udhcpc -i eth0 -q

echo "Network configured!"
ip addr show eth0
EOF

# 7. Rebuild initramfs
find . | cpio -H newc -o | gzip > ../initramfs-with-network.cpio.gz

# 8. Copy to vfkit location
cp ../initramfs-with-network.cpio.gz ~/.vfkit/vms/vibecode-alpine/kernel/initramfs-network

# 9. Update launch script
cd /Users/ryan.maclean/vibecode-webgui
```

Update `/Users/ryan.maclean/vibecode-webgui/scripts/vfkit/launch-valkey.sh`:

```bash
# Change line 24 from:
INITRAMFS_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/initramfs"

# To:
INITRAMFS_PATH="${HOME}/.vfkit/vms/vibecode-alpine/kernel/initramfs-network"
```

**Test**:

```bash
./scripts/vfkit/launch-valkey.sh

# In another terminal, check logs:
tail -f ~/.vfkit/vms/valkey/logs/vm.log

# Should see:
# "Loading virtio-net driver..."
# "Configuring eth0..."
# "Running DHCP..."
# "Network configured!"
```

**Pros**:
- ✅ Keep using vfkit
- ✅ Keep fast boot (5-10 seconds)
- ✅ No additional dependencies

**Cons**:
- Need to rebuild initramfs for each kernel update
- Must match kernel/module versions exactly
- No built-in port forwarding (need SSH tunnel)

---

### Option 3: Use Cloud Images with vfkit (MODERATE - 2-3 hours)

Switch from minimal initramfs to full cloud images.

**Steps**:

```bash
cd /Users/ryan.maclean/vibecode-webgui

# 1. Download Alpine cloud image
mkdir -p ~/.vfkit/images
cd ~/.vfkit/images
wget https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2

# 2. Convert to raw format (vfkit prefers raw)
qemu-img convert -f qcow2 -O raw \
  nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2 \
  alpine-3.22-cloud.img

# 3. Create VM-specific disk
mkdir -p ~/.vfkit/vms/valkey-cloud
qemu-img create -f qcow2 -b alpine-3.22-cloud.img -F raw \
  ~/.vfkit/vms/valkey-cloud/disk.qcow2 10G

# 4. Create cloud-init config
mkdir -p ~/.vfkit/vms/valkey-cloud/cloud-init

cat > ~/.vfkit/vms/valkey-cloud/cloud-init/user-data <<'EOF'
#cloud-config
package_update: true
packages:
  - valkey
  - valkey-cli

runcmd:
  - rc-update add valkey default
  - rc-service valkey start
EOF

cat > ~/.vfkit/vms/valkey-cloud/cloud-init/meta-data <<'EOF'
instance-id: valkey-001
local-hostname: valkey
EOF

# 5. Create new launch script
cat > scripts/vfkit/launch-valkey-cloud.sh <<'EOF'
#!/bin/bash
set -euo pipefail

vfkit \
  --cpus 2 \
  --memory 1024 \
  --bootloader "efi,variable-store=${HOME}/.vfkit/vms/valkey-cloud/efi-vars.fd,create" \
  --device "virtio-blk,path=${HOME}/.vfkit/vms/valkey-cloud/disk.qcow2" \
  --device "virtio-net,nat,mac=52:54:00:12:34:59" \
  --device "virtio-serial,logFilePath=${HOME}/.vfkit/vms/valkey-cloud/console.log" \
  --cloud-init "${HOME}/.vfkit/vms/valkey-cloud/cloud-init/user-data,${HOME}/.vfkit/vms/valkey-cloud/cloud-init/meta-data" \
  --gui  # Optional: remove after verifying it works
EOF

chmod +x scripts/vfkit/launch-valkey-cloud.sh

# 6. Launch VM
./scripts/vfkit/launch-valkey-cloud.sh
```

**Test**:

```bash
# Wait 30-60 seconds for cloud-init to finish

# Check console log
tail -f ~/.vfkit/vms/valkey-cloud/console.log

# Should see:
# "eth0: Link is Up"
# "cloud-init[...]: Installed valkey"
```

**Pros**:
- ✅ Keep using vfkit
- ✅ Full OS with all drivers
- ✅ Cloud-init for provisioning
- ✅ Networking guaranteed to work

**Cons**:
- Slower boot (30-60 seconds)
- Larger disk images (GB vs MB)
- More complex cloud-init config
- No built-in port forwarding

---

## Port Forwarding Solutions

All vfkit options need external port forwarding:

### Method A: SSH Tunnel (Simplest)

```bash
# 1. Start VM and get IP
VM_IP=$(limactl shell vibecode-valkey ip -4 addr show eth0 | grep inet | awk '{print $2}' | cut -d/ -f1)

# 2. Set up tunnel
ssh -L 6379:localhost:6379 -N root@${VM_IP} &

# 3. Test from host
valkey-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping
# ✅ PONG
```

### Method B: macOS pf Rules (Persistent)

```bash
# 1. Create pf rule file
sudo tee /etc/pf.anchors/vfkit-valkey <<'EOF'
rdr pass on lo0 inet proto tcp from any to any port 6379 -> 192.168.64.2 port 6379
EOF

# 2. Update pf.conf
echo "rdr-anchor \"vfkit-valkey\"" | sudo tee -a /etc/pf.conf
echo "load anchor \"vfkit-valkey\" from \"/etc/pf.anchors/vfkit-valkey\"" | sudo tee -a /etc/pf.conf

# 3. Enable pf
sudo pfctl -ef /etc/pf.conf

# 4. Test
valkey-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping
```

---

## Verification Tests

After implementing any option, run these tests:

```bash
# Test 1: Check eth0 exists
limactl shell vibecode-valkey ip addr show eth0
# ✅ Should show: "inet 192.168.x.x/24"

# Test 2: Check internet connectivity
limactl shell vibecode-valkey ping -c 3 8.8.8.8
# ✅ Should show: "3 packets transmitted, 3 received"

# Test 3: Check DNS resolution
limactl shell vibecode-valkey nslookup google.com
# ✅ Should resolve to IP address

# Test 4: Check Valkey responds
limactl shell vibecode-valkey valkey-cli -a VibeCodeChangeMe2025 ping
# ✅ Should return: "PONG"

# Test 5: Check from host (with port forwarding)
valkey-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping
# ✅ Should return: "PONG"
```

---

## Troubleshooting

### Issue: eth0 still missing

**Check kernel modules**:
```bash
limactl shell vibecode-valkey
lsmod | grep virtio
# Should show: virtio_net, net_failover, failover
```

**If missing**:
```bash
modprobe virtio_net
ip link set eth0 up
```

### Issue: DHCP fails

**Error**: `udhcpc: socket(AF_PACKET,2,8): Address family not supported by protocol`

**Solution**: Kernel needs `CONFIG_PACKET=y`

**Workaround**: Use static IP:
```bash
ip addr add 192.168.64.10/24 dev eth0
ip route add default via 192.168.64.1
```

### Issue: Port forwarding doesn't work

**Check VM IP**:
```bash
limactl shell vibecode-valkey ip addr show eth0
```

**Check Valkey is listening**:
```bash
limactl shell vibecode-valkey netstat -tlnp | grep 6379
```

**Check SSH tunnel is running**:
```bash
ps aux | grep ssh.*6379
```

---

## Recommendations

### For Production

**Use Option 1 (Lima)**:
- Proven to work
- Full YAML configuration
- Built-in port forwarding
- Easy lifecycle management
- Already tested in this project

### For Development

**Use Option 1 or 2**:
- Option 1: Best overall experience
- Option 2: Keep vfkit, fast boot

### For Minimal Setup

**Use Option 2**:
- Smallest disk footprint
- Fastest boot time
- No additional tools

---

## Next Steps

1. Pick one option above
2. Follow the steps
3. Run verification tests
4. Document which option you chose in project README
5. Update CI/CD if needed

---

## Related Files

- Full analysis: `/Users/ryan.maclean/vibecode-webgui/docs/LIMA_VZ_NETWORKING_ANALYSIS.md`
- Lima configs: `/Users/ryan.maclean/vibecode-webgui/config/lima/`
- vfkit scripts: `/Users/ryan.maclean/vibecode-webgui/scripts/vfkit/`
- Swift VZ code: `/Users/ryan.maclean/vibecode-webgui/vz-swift/Sources/VibeCodeVM/NetworkConfig.swift`

---

**Status**: Ready to implement
**Estimated Time**: 30 minutes (Option 1) to 3 hours (Option 3)
**Recommendation**: Start with Option 1 (lima) - it's already working
