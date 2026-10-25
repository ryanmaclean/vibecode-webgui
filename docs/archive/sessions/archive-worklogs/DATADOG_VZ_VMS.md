# Datadog Integration for Apple VZ VMs

## Current Status

The VibeCode native Swift app runs 6 VMs using Apple's Virtualization.framework:

| VM Name | Service | Status | Datadog Agent |
|---------|---------|--------|---------------|
| vibecode-valkey | Valkey 7.2 | ✅ Running | ❌ Not installed |
| vibecode-postgresql | PostgreSQL 16 | ✅ Ready | ❌ Not installed |
| vibecode-pgvector | PostgreSQL + pgvector | ✅ Ready | ❌ Not installed |
| vibecode-nodejs | Node.js 20 | ✅ Ready | ❌ Not installed |
| vibecode-nodejs-codeserver | code-server | ✅ Auto-starts | ❌ Not installed |
| vibecode-ide | openvscode-server | ✅ Ready | ❌ Not installed |

## Problem

Current VM images are plain Alpine Linux cloud images without Datadog agents installed.

## Solution: Rebuild with Cloud-init

We use cloud-init to create new VM images with Datadog agents pre-installed.

### Why This Approach?

1. **VZ Compatible** - Works natively with Apple Virtualization.framework
2. **Pre-installed** - Datadog runs immediately on first boot
3. **Reproducible** - Version controlled, easy to update
4. **Production Ready** - Same images work for development and distribution

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Download Alpine Cloud Image (QCOW2)                      │
│    - Alpine 3.22 ARM64 with cloud-init support              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Create cloud-init Configuration                           │
│    - Install Datadog agent                                   │
│    - Configure service (Valkey, PostgreSQL, etc.)            │
│    - Set up SSH for debugging                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Create VM Disk Image                                      │
│    - Attach cloud-init ISO                                   │
│    - Convert to RAW format for VZ                            │
│    - Create EFI NVRAM file                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. First Boot in VibeCode App                                │
│    - Cloud-init provisions VM (2-3 minutes)                  │
│    - Datadog agent starts automatically                      │
│    - Service starts (Valkey, code-server, etc.)              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Subsequent Boots                                          │
│    - Fast boot (~5-10 seconds)                               │
│    - Datadog already configured                              │
│    - Services auto-start                                     │
└─────────────────────────────────────────────────────────────┘
```

## Build New VM Images

### Prerequisites

```bash
# Install qemu-img if not present
brew install qemu

# Set your Datadog API key
export DATADOG_API_KEY="your_dd_api_key_here"
export DATADOG_SITE="datadoghq.com"  # or datadoghq.eu
```

### Build All VMs

```bash
./scripts/build-vz-vms-with-datadog.sh
```

This will:
1. Backup existing VMs to `dist/vm-images.backup.TIMESTAMP/`
2. Download Alpine cloud image (~50MB)
3. Build 6 new VM images with Datadog (~30-45 minutes)
4. Place them in `dist/vm-images/`

### Launch with New Images

```bash
# Stop current app
pkill VibeCode

# Launch with new images
./scripts/launch-vibecode.sh
```

## First Boot Process

When you start a VM for the first time with the new image:

1. **Boot starts** (~5 seconds)
2. **Cloud-init runs** (~2-3 minutes)
   - Installs packages
   - Configures Datadog
   - Sets up service (Valkey, PostgreSQL, etc.)
   - Starts Datadog agent
3. **VM ready** - Datadog reporting to dashboard

**Important:** Don't restart the VM during first boot. Watch the VibeCode app logs:

```bash
tail -f /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log
```

## Verify Datadog is Working

### 1. Check Datadog Dashboard

Visit: https://app.datadoghq.com/infrastructure

Look for hosts with tags:
- `env:vibecode`
- `platform:apple-vz`
- `app:vibecode-native`

### 2. SSH into VM (After First Boot)

```bash
# Find VM IP (will be added to VibeCode UI later)
# For now, VMs use NAT networking

# SSH in (password: vibecode)
ssh root@<vm-ip>

# Check Datadog status
datadog-agent status

# View Datadog logs
tail -f /var/log/datadog/agent.log
```

### 3. Check VM Services

```bash
# Valkey
ssh root@<valkey-ip> "valkey-cli ping"

# PostgreSQL
ssh root@<postgresql-ip> "psql -U postgres -c 'SELECT version();'"

# code-server
curl http://<codeserver-ip>:8080
```

## Datadog Configuration

Each VM is tagged with:

```yaml
tags:
  - env:vibecode
  - vm:<vm-name>
  - service:<service-name>
  - platform:apple-vz
  - app:vibecode-native
```

This allows you to:
- Filter by environment (`env:vibecode`)
- Group by service (`service:valkey`, `service:postgresql`)
- Track VZ-specific metrics (`platform:apple-vz`)

## Monitoring Features

### Logs
- ✅ System logs collected
- ✅ Service logs (Valkey, PostgreSQL, etc.)
- ✅ Datadog agent logs

### Metrics
- ✅ CPU, memory, disk usage
- ✅ Network I/O
- ✅ Service-specific metrics (Valkey ops/sec, PostgreSQL connections)

### APM (Application Performance Monitoring)
- ✅ Enabled for all VMs
- ✅ Distributed tracing support
- ✅ Service map generation

### Process Monitoring
- ✅ Process list
- ✅ Resource usage per process

## Troubleshooting

### VM Won't Boot After Rebuild

1. Check EFI NVRAM file exists:
   ```bash
   ls -lh dist/vm-images/*-efi.nvram
   ```

2. Verify disk image is RAW format:
   ```bash
   file dist/vm-images/*.img
   # Should show: "DOS/MBR boot sector"
   ```

3. Check VibeCode app logs:
   ```bash
   tail -f logs/vibecode.log
   ```

### Datadog Agent Not Reporting

1. Check if agent is running in VM:
   ```bash
   ssh root@<vm-ip> "service datadog-agent status"
   ```

2. Verify API key is correct:
   ```bash
   ssh root@<vm-ip> "cat /etc/datadog-agent/datadog.yaml | grep api_key"
   ```

3. Check agent logs:
   ```bash
   ssh root@<vm-ip> "tail -f /var/log/datadog/agent.log"
   ```

### First Boot Takes Too Long

Cloud-init provisioning normally takes 2-3 minutes. If longer:

1. Check VM has network access
2. Watch cloud-init logs in VM:
   ```bash
   ssh root@<vm-ip> "tail -f /var/log/cloud-init.log"
   ```

## Update Datadog Agent

To update the agent in existing VMs:

```bash
# SSH into each VM
ssh root@<vm-ip>

# Update Datadog
DD_API_KEY=$DATADOG_API_KEY bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"

# Restart agent
service datadog-agent restart
```

Or rebuild the VM images with updated configuration.

## Alternative: Lima VMs (Development)

For development/testing, you can use Lima VMs with Datadog:

```bash
./scripts/start-lima-vms-with-datadog.sh
```

**Pros:**
- Faster to set up
- Easier to iterate
- Better dev tooling

**Cons:**
- Not usable in VibeCode native app distribution
- Different from production environment

## Cost Considerations

- **Datadog Free Tier**: 5 hosts free
- **Current Setup**: 6 VMs = $15/month (1 VM over free tier)
- **Recommendation**: Use for development, consider disabling for idle VMs

## Next Steps

1. ✅ Build VMs with Datadog
2. ✅ Test in VibeCode app
3. ⏭️ Add VM networking details to UI
4. ⏭️ Add Datadog dashboard links in app
5. ⏭️ Set up Datadog monitors/alerts
6. ⏭️ Document SSH access in UI

## References

- [Apple Virtualization.framework](https://developer.apple.com/documentation/virtualization)
- [Datadog Agent Installation](https://docs.datadoghq.com/agent/)
- [Alpine Cloud-init](https://docs.alpinelinux.org/user-handbook/0.1a/Installing/setup-alpine.html#_cloud_init)
- [VibeCode VM Architecture](./SWIFT_NATIVE_APP_PROPOSAL.md)

