# Usage Guide - VibeCode v0.9-beta

How to use the VibeCode Native VM Manager.

---

## Quick Start

### 1. Launch the App

```bash
cd vibecode-webgui
./scripts/launch-vibecode.sh
```

Or:
```bash
open VibeCodeSwift/.build/release/VibeCode.app
```

### 2. Discover VMs

The app automatically discovers VMs from:
- `dist/vm-images/` directory
- Looks for `.img` and `-efi.nvram` files
- Displays all 6 VMs in sidebar

### 3. Start a VM

**Working VMs** (v0.9-beta):
1. Click **"Pgvector"** in sidebar
2. Click **"Start VM"** button  
3. Wait 15-30 seconds for boot
4. Status changes to "Running" (green dot)

Repeat for **"Ide"** VM.

---

## VM Management

### View VM Details

Click any VM in the sidebar to see:
- CPU Cores: 4
- Memory: 4 GB
- Disk Size: varies by VM
- Type: Linux (Alpine)
- Current Status

### Start a VM

1. Select VM from sidebar
2. Click blue "Start VM" button
3. Watch status change: Stopped → Starting → Running
4. Green dot indicates running state

### Stop a VM

1. Select running VM
2. Click "Stop VM" button
3. Wait for graceful shutdown
4. Status returns to "Stopped"

---

## Accessing Services

### Find VM IP Addresses

```bash
./scripts/find-vm-ips.sh
```

Shows all VMs on the network with their IPs (192.168.64.x range).

### Connect to Services

**Note**: Services must be installed in VMs first (not included in v0.9-beta).

When services are available:

**PostgreSQL**:
```bash
psql -h 192.168.64.X -p 5432 -U postgres
```

**Valkey/Redis**:
```bash
redis-cli -h 192.168.64.X -p 6379
```

**Node.js**:
```bash
curl http://192.168.64.X:3000
```

**OpenVSCode**:
```bash
open http://192.168.64.X:8080
```

### SSH Access (When Configured)

```bash
# Use prepared SSH config
ssh -F ~/.ssh/vibecode/config vibecode-postgresql

# Or direct
ssh vibecode@192.168.64.X
```

---

## VM List

### Available VMs

| VM Name | Purpose | Disk Size | Status (v0.9) |
|---------|---------|-----------|---------------|
| **Pgvector** | PostgreSQL + vectors | 20 GB | ✅ Working |
| **Ide** | Development tools | 50 GB | ✅ Working |
| **Postgresql** | Database server | 15 GB | ⚠️ Bootloader issue |
| **Nodejs** | JavaScript runtime | 15 GB | ⚠️ Bootloader issue |
| **Nodejs-Codeserver** | OpenVSCode | 20 GB | ⚠️ Bootloader issue |
| **Valkey** | Redis cache | 10 GB | ⚠️ Bootloader issue |

### VM Specifications

All VMs configured with:
- **CPU**: 4 cores
- **Memory**: 4 GB
- **Network**: VirtIO NAT (auto-configured)
- **Boot**: UEFI with EFI variables
- **OS**: Alpine Linux 3.19

---

## Network Configuration

### How It Works

```
Your Mac (Host)
└── bridge100 (192.168.64.1)
    ├── VM 1 (192.168.64.2)
    ├── VM 2 (192.168.64.3)
    ├── VM 3 (192.168.64.4)
    └── ...
```

- VMs get DHCP addresses automatically
- NAT provides internet access to VMs
- Host can access VMs at their IP addresses
- VMs can access each other

### Find Active VMs

```bash
# Scan network
arp -a | grep 192.168.64

# Or use helper script
./scripts/find-vm-ips.sh
```

### Test Connectivity

```bash
# Ping a VM
ping 192.168.64.X

# Check specific port
nc -zv 192.168.64.X 5432
```

---

## Monitoring

### View Application Logs

```bash
# Real-time
tail -f ~/vibecode-webgui/logs/vibecode.log

# Last 100 lines
tail -100 ~/vibecode-webgui/logs/vibecode.log
```

### View VM Console Output

```bash
# When VMs are running
tail -f ~/vibecode-webgui/logs/Pgvector-console.log
tail -f ~/vibecode-webgui/logs/Ide-console.log
```

### Check VM Status Programmatically

```bash
# View logs for VM status
grep "VM started\|VM stopped" ~/vibecode-webgui/logs/vibecode.log
```

---

## Testing

### Run Health Checks

```bash
# Test a specific VM
./scripts/test-service-health.sh 192.168.64.X

# Complete validation
./scripts/staff-level-test-suite.sh
```

### Expected Test Results

v0.9-beta: **27/33 tests passing (82%)**

Passing:
- ✅ Infrastructure (all tests)
- ✅ VM discovery (all tests)
- ✅ Network (all tests)

Failing:
- ❌ Service availability (services not installed)

---

## Troubleshooting

### VM Won't Start - "Invalid Boot Loader"

**Quick Fix**:
```bash
# Copy working EFI to broken VM
cp dist/vm-images/vibecode-ide-efi.nvram \
   dist/vm-images/vibecode-postgresql-efi.nvram

# Restart app
killall VibeCode
./scripts/launch-vibecode.sh
```

### VMs Not Discovered

**Check VM files**:
```bash
ls -lh dist/vm-images/

# Should show:
# vibecode-*.img (6 files)
# vibecode-*-efi.nvram (6 files)
```

**Check app is looking in right place**:
```bash
# View discovery logs
grep "VM discovery\|Found VMs" ~/vibecode-webgui/logs/vibecode.log
```

### App Won't Launch - Entitlement Error

**Check signing**:
```bash
codesign -d --entitlements - \
  VibeCodeSwift/.build/release/VibeCode.app 2>&1 | \
  grep virtualization
```

**Re-sign if needed**:
```bash
./scripts/launch-vibecode.sh
# This handles signing automatically
```

### No Network Connectivity

**Check bridge network**:
```bash
ifconfig bridge100
# Should show: inet 192.168.64.1
```

**If missing**: Restart Mac or check system virtualization settings.

---

## Advanced Usage

### Run Multiple VMs Simultaneously

The app supports running all VMs at once:
- Each uses 4 GB RAM
- 6 VMs = ~24 GB total
- Ensure you have enough RAM

### Custom VM Images

To add your own VMs:
1. Place `.img` file in `dist/vm-images/`
2. Create matching `-efi.nvram` file
3. Restart app - will auto-discover

### Performance Tuning

**For better performance**:
- Use SSD for VM storage
- Allocate more RAM if available
- Close other applications
- Run on macOS 26 Tahoe for ASIF format (2-3x faster)

---

## Datadog Integration (Optional)

If you have Datadog agent installed:

### View Metrics

```bash
# Check if metrics are being sent
datadog-agent status | grep vibecode

# Dashboard (if configured)
# https://app.datadoghq.com/metric/summary?filter=vibecode
```

### Metrics Tracked

- `vibecode.vm.discovered_count` - VMs found
- `vibecode.vm.start.attempt` - Start attempts
- `vibecode.vm.start.success` - Successful starts
- `vibecode.vm.start.failure` - Failed starts
- `vibecode.vm.start.duration` - Boot time
- `vibecode.vm.running_count` - Currently running

---

## Uninstall

### Remove Application

```bash
rm -rf VibeCodeSwift/.build/release/VibeCode.app
rm -rf /Applications/VibeCode.app
```

### Remove VM Images

```bash
rm -rf dist/vm-images/
```

### Remove Logs

```bash
rm -rf logs/
```

### Remove SSH Keys (If Created)

```bash
rm -rf ~/.ssh/vibecode/
```

---

## Getting Help

### Documentation
- Build issues: This file
- App usage: `README.md`
- Status: `VMS_WORKING_STATUS.md`
- Architecture: `docs/OBSERVABILITY_STRATEGY.md`

### Logs
```bash
# Application
~/vibecode-webgui/logs/vibecode.log

# Console output
~/vibecode-webgui/logs/*-console.log

# Test results
~/vibecode-webgui/logs/staff-test-results.txt
```

### Support
- GitHub Issues: https://github.com/ryanmaclean/vibecode-webgui/issues
- Documentation: `/docs/` directory

---

## What's Next

### v1.0 Features (Coming Soon)
- All 6 VMs booting successfully
- Services installed (PostgreSQL, Valkey, Node.js, VSCode)
- SSH access configured
- Tauri app integration
- 100% test coverage

### Try It Out

```bash
# Launch the app
./scripts/launch-vibecode.sh

# Start working VMs
# 1. Click "Pgvector" → Start VM
# 2. Click "Ide" → Start VM

# Monitor status
tail -f ~/vibecode-webgui/logs/vibecode.log
```

---

**VibeCode v0.9-beta** - Native macOS VM Management  
Infrastructure ready, services coming in v1.0

