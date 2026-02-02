# macOS VM Creation Workflow

## Prerequisites

1. **macOS Restore Image (.ipsw)**
   - Download from: https://developer.apple.com/download
   - Requires Apple Developer account (free tier works)
   - Choose ARM64 version for Apple Silicon
   - File size: ~12-15GB

2. **Hardware Requirements**
   - Apple Silicon Mac (M1/M2/M3/M4)
   - macOS 13.0+ (Ventura or later)
   - 4GB+ free RAM for VM
   - 25GB+ free disk space

## Step 1: Download .ipsw

```bash
# Visit: https://developer.apple.com/download
# Search for: "macOS Sonoma" or "macOS Sequoia" or "macOS Tahoe"
# Download: RestoreImage_*.ipsw (ARM64)
```

## Step 2: Create VM

```bash
cd platforms/macos/vz-swift
swift build -c release
./.build/release/vibecode-vm-standalone openclaw openclaw-tiny
```

## Step 3: First Boot

1. VM will boot to macOS installer
2. Follow installation wizard
3. Create admin account
4. Complete setup

## Step 4: Install OpenClaw

Run inside VM:
```bash
./scripts/vz/install-openclaw-in-vm.sh
```

## Step 5: Configure Tailscale

Run inside VM:
```bash
./scripts/vz/setup-tailscale-vm.sh
```

## Troubleshooting

- **VM won't boot**: Check .ipsw is valid and ARM64
- **No networking**: Verify MAC address fix applied
- **Installation fails**: Check disk space (need 20GB+)

## Troubleshooting

### VM Won't Boot
- **Issue**: VM fails to start
- **Solution**: Verify .ipsw is valid ARM64 image, check disk space (need 25GB+)

### No Networking
- **Issue**: VM has no network connectivity
- **Solution**: Verify MAC address fix applied (no explicit MAC in code), check VZNATNetworkDeviceAttachment

### Installation Fails
- **Issue**: macOS installer fails
- **Solution**: Ensure hardware model persisted, check disk size (20GB+), verify .ipsw integrity

### OpenClaw Won't Start
- **Issue**: OpenClaw gateway not accessible
- **Solution**: Check launchd service, verify port 18789 not blocked, check logs in /tmp/openclaw/

## Advanced Configuration

### Custom Hardware Model
```bash
# Reuse existing hardware model
cp ~/.vfkit/vms/other-vm/hardware-model.bin ~/.vfkit/vms/openclaw-tiny/
```

### Snapshot Management
```bash
# Create snapshot before major changes
cp ~/.vfkit/vms/openclaw-tiny/openclaw.img ~/.vfkit/vms/openclaw-tiny/openclaw.img.backup
```
