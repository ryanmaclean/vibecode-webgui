# Quick Build Reference

## GUI VM (VibeCodeServices)

### One-liner Build
```bash
cd /Users/ryan.maclean/vibecode-webgui && \
  python3 scripts/build_gui_linux_vm_swift.py --name VibeCodeServices && \
  bash azure/SwiftUI-Apps/build_vibecodeservices.sh && \
  open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
```

### Clean Rebuild
```bash
cd /Users/ryan.maclean/vibecode-webgui && \
  killall VibeCodeServicesVibeCode 2>/dev/null; \
  rm -rf azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app \
         azure/SwiftUI-Apps/VibeCodeServices* \
         ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/ && \
  python3 scripts/build_gui_linux_vm_swift.py --name VibeCodeServices && \
  bash azure/SwiftUI-Apps/build_vibecodeservices.sh && \
  open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
```

### Verify Build
```bash
# Check app size (should be ~188KB)
du -sh azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app

# Check binary
file azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode

# Check entitlements
codesign -d --entitlements - azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode
```

### Verify VM Running
```bash
# Check app process
ps aux | grep VibeCodeServices | grep -v grep

# Check VM process
ps aux | grep "Virtualization.VirtualMachine" | grep -v grep

# Check VM bundle
ls -la ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/

# Check disk is sparse (should show 0B)
du -sh ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/Disk.img

# Check network
cat /var/db/dhcpd_leases | grep -A3 "ip_address=192.168.64"
```

---

## Other VM Apps

### NodeJS VM
```bash
open azure/SwiftUI-Apps/NodeJSVibeCode.app
```

### Valkey VM
```bash
open azure/SwiftUI-Apps/ValkeyVibeCode.app
```

### PostgreSQL VM
```bash
open azure/SwiftUI-Apps/PostgreSQLVibeCode.app
```

---

## Key Files

| Purpose | Path |
|---------|------|
| Python Generator | `scripts/build_gui_linux_vm_swift.py` |
| Generated Swift | `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.swift` |
| Build Script | `azure/SwiftUI-Apps/build_vibecodeservices.sh` |
| Entitlements | `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.entitlements` |
| App Bundle | `azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/` |
| VM Bundle | `~/VibeCode VMs/VibeCodeServices VM.bundle/` |
| Kernel | `azure/linux-kernel-arm64` |
| Initramfs | `azure/unified-services-with-datadog.cpio.gz` |

---

## Troubleshooting

### App doesn't start
```bash
# Run from terminal to see errors
azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode
```

### VM doesn't boot
```bash
# Check kernel exists
ls -la azure/linux-kernel-arm64

# Check initramfs exists
ls -la azure/unified-services-with-datadog.cpio.gz
```

### Network issues
```bash
# Check DHCP
cat /var/db/dhcpd_leases

# Ping VM
ping 192.168.64.X
```

---

## Expected Results

| Metric | Value |
|--------|-------|
| App Size | ~188KB |
| Binary Size | ~177KB |
| Disk Size (logical) | 1GB |
| Disk Size (actual) | 0B (sparse) |
| Boot Time | ~10-30s |
| Memory | 8GB |
| CPUs | Half of host |


