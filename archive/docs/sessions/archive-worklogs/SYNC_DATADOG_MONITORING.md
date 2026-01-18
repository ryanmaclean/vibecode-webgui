# Sync Datadog Monitoring: i7-zfs-pop ↔ i9-zfs-pop

## Current Status

### ✅ i7-zfs-pop.local
- API Key: **Updated** to `DD_API_KEY_FROM_ENV`
- Agent: Running (v7.73.0)
- Monitoring: All features enabled (logs, APM, process, network, ZFS)

### ⚠️ i9-zfs-pop.local  
- API Key: **Needs update** to `DD_API_KEY_FROM_ENV`
- Agent: Installed but needs to be started
- Monitoring: Needs configuration sync

## Commands to Run on i9-zfs-pop.local

Run these commands **on i9-zfs-pop.local** (SSH into it first):

```bash
# 1. Update API key
sudo sed -i 's/^api_key:.*/api_key: DD_API_KEY_FROM_ENV/' /etc/datadog-agent/datadog.yaml

# 2. Ensure monitoring features are enabled
sudo cp /etc/datadog-agent/datadog.yaml /etc/datadog-agent/datadog.yaml.backup.$(date +%Y%m%d_%H%M%S)

# Enable logs
if ! grep -q '^logs_enabled: true' /etc/datadog-agent/datadog.yaml; then
    sed -i '/^logs_enabled:/d' /etc/datadog-agent/datadog.yaml
    echo 'logs_enabled: true' | sudo tee -a /etc/datadog-agent/datadog.yaml
fi

# Enable APM
if ! grep -q 'apm_config:' /etc/datadog-agent/datadog.yaml; then
    echo -e 'apm_config:\n  enabled: true' | sudo tee -a /etc/datadog-agent/datadog.yaml
fi

# Enable process monitoring
if ! grep -q 'process_config:' /etc/datadog-agent/datadog.yaml; then
    echo -e 'process_config:\n  enabled: true' | sudo tee -a /etc/datadog-agent/datadog.yaml
fi

# Enable network monitoring
if ! grep -q 'network_config:' /etc/datadog-agent/datadog.yaml; then
    echo -e 'network_config:\n  enabled: true' | sudo tee -a /etc/datadog-agent/datadog.yaml
fi

# Enable remote config
if ! grep -q 'remote_updates:' /etc/datadog-agent/datadog.yaml; then
    echo 'remote_updates: true' | sudo tee -a /etc/datadog-agent/datadog.yaml
fi

# 3. Configure ZFS monitoring (same as i7)
sudo mkdir -p /etc/datadog-agent/conf.d/zfs.d
sudo tee /etc/datadog-agent/conf.d/zfs.d/conf.yaml > /dev/null << 'EOF'
init_config:

instances:
  - tags:
      - env:production
      - service:zfs
EOF

sudo chown dd-agent:dd-agent /etc/datadog-agent/conf.d/zfs.d/conf.yaml

# 4. Start and enable agent (no reboot needed)
sudo systemctl start datadog-agent
sudo systemctl enable datadog-agent

# 5. Reload configuration
sudo systemctl reload datadog-agent

# 6. Verify
sudo datadog-agent status | head -20
sudo datadog-agent configcheck | grep -E 'zfs|logs|apm|process|network'
```

## Verification Commands

After running the above, verify both hosts match:

```bash
# Check API keys match
echo "i7 API key:"
ssh i7-zfs-pop.local "sudo grep '^api_key:' /etc/datadog-agent/datadog.yaml"

echo "i9 API key:"
ssh i9-zfs-pop.local "sudo grep '^api_key:' /etc/datadog-agent/datadog.yaml"

# Check agent status
echo "i7 status:"
ssh i7-zfs-pop.local "sudo systemctl is-active datadog-agent"

echo "i9 status:"
ssh i9-zfs-pop.local "sudo systemctl is-active datadog-agent"

# Check monitoring features
echo "i7 monitoring:"
ssh i7-zfs-pop.local "sudo datadog-agent configcheck | grep -E 'zfs|logs|apm|process|network'"

echo "i9 monitoring:"
ssh i9-zfs-pop.local "sudo datadog-agent configcheck | grep -E 'zfs|logs|apm|process|network'"
```

## Expected Result

Both hosts should have:
- ✅ Same API key: `DD_API_KEY_FROM_ENV`
- ✅ Agent running and enabled
- ✅ Logs collection enabled
- ✅ APM enabled
- ✅ Process monitoring enabled
- ✅ Network monitoring enabled
- ✅ ZFS monitoring configured
- ✅ Remote configuration enabled

## Notes

- **No reboots required** - all changes use `systemctl reload` which doesn't interrupt running tasks
- Both hosts will have identical monitoring configuration
- API keys are now synchronized from `.env.local`
