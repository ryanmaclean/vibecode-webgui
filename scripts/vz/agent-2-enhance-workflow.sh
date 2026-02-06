#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Agent 2: Enhance macOS VM Workflow Documentation

# Initialize log aggregation
init_log_aggregation

set -e

echo "=== Agent 2: Enhancing macOS VM Workflow ==="

# Add troubleshooting section
cat >> docs/vm/macos-vm-workflow.md << 'DOCEOF'

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
DOCEOF

echo "✅ Enhanced workflow documentation"
