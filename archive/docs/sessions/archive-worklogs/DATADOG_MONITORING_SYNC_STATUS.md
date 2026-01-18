# Datadog Monitoring Sync Status

## Current Status

### i7-zfs-pop.local
- ✅ Datadog Agent: Running (v7.73.0)
- ✅ API Key: Updated to DD_API_KEY_FROM_ENV
- ✅ Monitoring Features:
  - Logs: Enabled (HTTP compression)
  - APM: Enabled
  - Process: Configured
  - Network: Enabled
  - ZFS: Configured with tags
  - Remote Config: Enabled

### i9-zfs-pop.local
- ⚠️ Datadog Agent: Installed but inactive/not enabled
- ❌ API Key: Needs update
- ❌ ZFS Monitoring: Not configured
- ❌ Monitoring Features: Need to be enabled

## Actions Required

1. **i9-zfs-pop.local needs:**
   - Start and enable Datadog agent service
   - Update API key to: DD_API_KEY_FROM_ENV
   - Copy ZFS monitoring config from i7
   - Enable all monitoring features (logs, APM, process, network)
   - Reload agent (no reboot needed)

2. **Both hosts should have:**
   - Same API key: DD_API_KEY_FROM_ENV
   - Same monitoring features enabled
   - Same ZFS check configuration
   - Remote configuration enabled

## Commands to Run (on i9-zfs-pop.local)

```bash
# Update API key
sudo sed -i 's/^api_key:.*/api_key: DD_API_KEY_FROM_ENV/' /etc/datadog-agent/datadog.yaml

# Copy ZFS config from i7
sudo mkdir -p /etc/datadog-agent/conf.d/zfs.d
# (Copy from i7-zfs-pop:/etc/datadog-agent/conf.d/zfs.d/conf.yaml)

# Start and enable agent
sudo systemctl start datadog-agent
sudo systemctl enable datadog-agent

# Reload configuration
sudo systemctl reload datadog-agent
```

## Note
- No reboots required - all changes can be done via service reload
- Both hosts are running tasks, so we're using reload instead of restart
