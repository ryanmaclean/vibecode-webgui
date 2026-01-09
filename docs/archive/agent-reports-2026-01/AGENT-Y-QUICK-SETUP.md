# Agent Y: Quick Setup Guide for Developers

**Get started with the developer-enhanced unified services VM in under 10 minutes.**

---

## Prerequisites

- macOS with vfkit installed
- Unified services VM built and working
- Terminal access
- VS Code installed (optional, for remote debugging)

---

## Step 1: Enable Developer Mode (2 minutes)

### Build VM with Developer Tools

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure

# Rebuild initramfs with developer tools
./build-unified-services-with-datadog.sh --with-dev-tools

# This will:
# - Install 25+ developer utilities
# - Add code formatters and linters
# - Configure hot reload system
# - Set up file synchronization
# - Enable remote debugging ports
```

**Expected output size:** ~150MB (vs 65MB base)

---

## Step 2: Start the VM (1 minute)

```bash
# Start VM with shared directory for file sync
vfkit \
  --cpus 4 \
  --memory 4096 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd ~/vibecode-webgui/azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-fs,sharedDir=$HOME/vibecode-shared,mountTag=hostshare \
  --device virtio-rng
```

**Note the addition of `--device virtio-fs` for file synchronization.**

---

## Step 3: Connect to VM (1 minute)

### Set Up SSH Key Authentication

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -f ~/.ssh/vibecode_vm -N ""

# Copy key to VM (password: vibecode)
ssh-copy-id -i ~/.ssh/vibecode_vm.pub root@192.168.64.10

# Add to SSH config
cat >> ~/.ssh/config << 'EOF'
Host vibecode-vm
    HostName 192.168.64.10
    User root
    IdentityFile ~/.ssh/vibecode_vm
    StrictHostKeyChecking no
    ServerAliveInterval 60
EOF

# Test connection (no password prompt!)
ssh vibecode-vm
```

---

## Step 4: Start File Sync (2 minutes)

### Set Up Bi-Directional Sync

```bash
# Create shared directory structure
mkdir -p ~/vibecode-shared/{config,data,logs,sync,tools}

# Copy sync script to VM
scp azure/vibecode-sync.sh vibecode-vm:/usr/local/bin/
ssh vibecode-vm 'chmod +x /usr/local/bin/vibecode-sync.sh'

# Start file sync watcher (on host)
cd ~/my-project
fswatch -o . | while read; do
    rsync -avz --delete \
        --exclude '.git' \
        --exclude 'node_modules' \
        ./ vibecode-vm:/mnt/host/sync/my-project/
done &
```

**Test sync:**
```bash
# On host: create a file
echo "console.log('hello');" > test.js

# On VM: check if it appears (should be <2 seconds)
ssh vibecode-vm 'ls -la /mnt/host/sync/my-project/test.js'
```

---

## Step 5: Enable Hot Reload (1 minute)

### Start Hot Reload Watcher

```bash
# SSH into VM
ssh vibecode-vm

# Start hot reload watcher
/usr/local/bin/hot-reload-watcher.sh &

# Check it's running
ps aux | grep hot-reload
```

**Test hot reload:**
```bash
# On host: modify a JS file
echo "// reload test" >> ~/my-project/app.js

# Watch VM logs
ssh vibecode-vm 'tail -f /tmp/hot-reload.log'

# Expected: "Reloading OpenVSCode..." within 10 seconds
```

---

## Step 6: Open Dev Dashboard (1 minute)

### Access Live Monitoring

```bash
# Option 1: Direct link
open http://192.168.64.10:9090

# Option 2: Port forward to localhost
ssh -L 9090:localhost:9090 vibecode-vm -N &
open http://localhost:9090
```

**Dashboard features:**
- Live service status
- Real-time log streaming
- Resource usage graphs
- Quick restart buttons
- Database query console

---

## Step 7: Configure Remote Debugging (2 minutes)

### VS Code Debugging Setup

Create `.vscode/launch.json` in your project:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Debug in VM",
      "address": "192.168.64.10",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/mnt/host/sync/${workspaceFolderBasename}",
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Debug OpenVSCode Server",
      "address": "192.168.64.10",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/opt/openvscode",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Start debugging:**
1. Set breakpoint in VS Code
2. Press F5 or click "Debug in VM"
3. Trigger code path
4. Breakpoint should hit!

---

## Quick Reference

### Essential Commands

```bash
# SSH into VM
ssh vibecode-vm

# View all service logs
ssh vibecode-vm 'multitail /tmp/*.log'

# Restart specific service
ssh vibecode-vm 'systemctl restart openvscode'  # or use dashboard

# Check hot reload status
ssh vibecode-vm 'cat /tmp/hot-reload.log | tail -20'

# Sync files manually (push)
rsync -avz ~/my-project/ vibecode-vm:/mnt/host/sync/my-project/

# Sync files manually (pull)
rsync -avz vibecode-vm:/mnt/host/sync/my-project/ ~/my-project/

# View resource usage
ssh vibecode-vm 'htop'  # or 'btop' for modern UI
```

### Service URLs

| Service | URL | Notes |
|---------|-----|-------|
| OpenVSCode | http://192.168.64.10:8080 | IDE interface |
| Dev Dashboard | http://192.168.64.10:9090 | Monitoring |
| pgAdmin | http://192.168.64.10:5050 | PostgreSQL GUI |
| Redis Commander | http://192.168.64.10:8081 | Valkey GUI |
| SSH | ssh://192.168.64.10:22 | Remote shell |

### Database Connections

**PostgreSQL:**
```bash
# From host
psql -h 192.168.64.10 -U postgres

# From VM
pgcli postgresql://postgres@localhost/postgres
```

**Valkey:**
```bash
# From host
redis-cli -h 192.168.64.10 -p 6379 PING

# From VM
redis-cli PING
```

---

## Development Workflow

### Typical Iteration Cycle

**Before (without dev tools):**
1. Edit code on host
2. Rebuild entire VM (~8 minutes)
3. Restart VM
4. Test changes
5. **Total: ~10 minutes per iteration**

**After (with dev tools):**
1. Edit code on host
2. File syncs automatically (<2s)
3. Service reloads automatically (<30s)
4. Test changes immediately
5. **Total: ~30 seconds per iteration**

**Time saved:** 9.5 minutes per iteration (95% reduction!)

---

## Troubleshooting

### Hot Reload Not Working

```bash
# Check watcher is running
ssh vibecode-vm 'ps aux | grep hot-reload'

# Check logs for errors
ssh vibecode-vm 'tail -50 /tmp/hot-reload.log'

# Restart watcher
ssh vibecode-vm 'pkill -f hot-reload && /usr/local/bin/hot-reload-watcher.sh &'

# Verify file sync
ssh vibecode-vm 'ls -la /mnt/host/sync/'
```

### File Sync Issues

```bash
# Check shared directory mounted
ssh vibecode-vm 'mount | grep hostshare'

# Expected output:
# hostshare on /mnt/host type virtiofs (rw,relatime)

# If not mounted, restart VM with --device virtio-fs flag

# Check file permissions
ssh vibecode-vm 'ls -la /mnt/host/sync/'

# Should be owned by root:root with 755 permissions
```

### Debugging Not Connecting

```bash
# Verify debug port open
nc -zv 192.168.64.10 9229

# Check OpenVSCode started with --inspect
ssh vibecode-vm 'ps aux | grep inspect'

# View OpenVSCode logs
ssh vibecode-vm 'tail -50 /tmp/openvscode.log | grep inspect'

# Restart OpenVSCode with debugging
ssh vibecode-vm 'killall openvscode-server && /opt/openvscode/bin/openvscode-server --host 0.0.0.0 --port 8080 --inspect=0.0.0.0:9229 &'
```

### Dashboard Not Loading

```bash
# Check dev dashboard API running
ssh vibecode-vm 'ps aux | grep dev-dashboard'

# Check port 9090 listening
ssh vibecode-vm 'netstat -tuln | grep 9090'

# Restart dashboard API
ssh vibecode-vm '/usr/local/bin/dev-dashboard-api &'

# Check logs
ssh vibecode-vm 'tail -50 /tmp/dev-dashboard.log'
```

---

## Performance Tips

### Optimize File Sync

```bash
# Create .rsync-exclude file
cat > ~/.rsync-exclude << 'EOF'
.git/
node_modules/
.DS_Store
*.log
__pycache__/
.venv/
dist/
build/
.next/
coverage/
.cache/
EOF

# Use exclude file in rsync
rsync -avz --delete --exclude-from=~/.rsync-exclude \
    ~/my-project/ vibecode-vm:/mnt/host/sync/my-project/
```

### Reduce Hot Reload Time

```bash
# Edit hot reload config
ssh vibecode-vm 'vim /mnt/host/config/.hotreload.yml'

# Reduce debounce delay (faster but more restarts)
debounce:
  delay_ms: 200  # default: 500

# Increase debounce (slower but batches changes)
debounce:
  delay_ms: 1000  # wait 1 second for more changes
```

### Allocate More Memory

```bash
# For development, use 4GB+ RAM
vfkit --memory 8192 ...  # 8GB for heavy development

# Check memory usage
ssh vibecode-vm 'free -h'
```

---

## Advanced Features

### Auto-Start on Boot

```bash
# Create LaunchAgent plist
cat > ~/Library/LaunchAgents/com.vibecode.vm.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.vm</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/vfkit</string>
        <string>--cpus</string>
        <string>4</string>
        <string>--memory</string>
        <string>4096</string>
        <string>--kernel</string>
        <string>/Users/YOUR_USERNAME/.vfkit/vms/vibecode-valkey/kernel/vmlinux</string>
        <string>--initrd</string>
        <string>/Users/YOUR_USERNAME/vibecode-webgui/azure/unified-services-static.cpio.gz</string>
        <string>--kernel-cmdline</string>
        <string>console=hvc0</string>
        <string>--device</string>
        <string>virtio-net,nat,mac=52:54:00:12:34:70</string>
        <string>--device</string>
        <string>virtio-fs,sharedDir=/Users/YOUR_USERNAME/vibecode-shared,mountTag=hostshare</string>
        <string>--device</string>
        <string>virtio-rng</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load LaunchAgent
launchctl load ~/Library/LaunchAgents/com.vibecode.vm.plist

# VM will now start automatically on login
```

### Multiple Project Sync

```bash
# Sync multiple projects to VM
for project in ~/projects/*; do
    rsync -avz --delete "$project/" \
        vibecode-vm:/mnt/host/sync/$(basename "$project")/ &
done

wait
echo "All projects synced!"
```

### Custom Dashboard Extensions

```bash
# Add custom metrics to dashboard
ssh vibecode-vm 'cat >> /usr/local/bin/custom-metrics.sh' << 'EOF'
#!/bin/bash
# Custom metrics script

while true; do
    # Your custom metric collection
    MY_METRIC=$(some_command)

    # Send to dashboard API
    curl -X POST http://localhost:9090/api/metrics \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"my_metric\",\"value\":$MY_METRIC}"

    sleep 5
done
EOF

ssh vibecode-vm 'chmod +x /usr/local/bin/custom-metrics.sh'
ssh vibecode-vm '/usr/local/bin/custom-metrics.sh &'
```

---

## Next Steps

1. ✅ **You're all set!** Start coding with hot reload
2. 📖 Read [AGENT-Y-IMPLEMENTATION-GUIDE.md](./AGENT-Y-IMPLEMENTATION-GUIDE.md) for internals
3. 🎯 Check [AGENT-Y-DEVELOPER-EXPERIENCE.md](./AGENT-Y-DEVELOPER-EXPERIENCE.md) for full design
4. 🐛 Report issues in project GitHub
5. 💡 Share your productivity improvements with the team!

---

## Time Investment Summary

| Setup Step | Time | Frequency |
|------------|------|-----------|
| Initial setup | 10 min | Once |
| Daily startup | 2 min | Daily |
| Per iteration | 30s | Per code change |

**ROI:** After ~5 iterations, you break even. After that, pure productivity gains!

**Estimated time saved:** 10-15 hours per week per developer

---

**Happy coding with VibeCo Developer Tools!**

---

**Agent Y - Developer Experience Enhancement**
**Status:** QUICK SETUP GUIDE COMPLETE
