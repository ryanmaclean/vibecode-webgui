# VibeCode Unified v3.0.0 - FINAL Delivery Guide

## Overview

VibeCode Unified v3.0.0 is a complete macOS SwiftUI application that runs a Linux virtual machine with 4 integrated services:

1. **OpenVSCode Server** - Web-based code editor (port 8080)
2. **Valkey** - Ultra-fast in-memory data store (port 6379)
3. **PostgreSQL** - Relational database (port 5432)
4. **SSH** - Terminal access (port 2222)

**Size**: 94 MB DMG | **Boot Time**: ~25 seconds | **RAM**: 2GB | **CPUs**: 4

---

## Installation Steps

### 1. Download and Mount DMG

```bash
# Navigate to Downloads or wherever you saved the DMG
cd ~/Downloads

# Double-click the DMG or mount via terminal
hdiutil attach VibeCode-Unified-v3.0.0-FINAL.dmg

# The DMG will mount and show two items:
# - VibeCode.app (the application)
# - Applications (symlink to /Applications)
```

### 2. Install Application

```bash
# Method A: Drag and drop (GUI)
# Drag VibeCode.app to the Applications folder in the DMG

# Method B: Command line
cp -r /Volumes/VibeCode\ Unified/VibeCode.app /Applications/

# Verify installation
ls -la /Applications/VibeCode.app
```

### 3. Launch Application

```bash
# Method A: Finder
# Open Applications folder → Double-click VibeCode.app

# Method B: Command line
open /Applications/VibeCode.app

# Method C: Spotlight
# Cmd+Space → Type "VibeCode" → Press Enter
```

### 4. Grant Virtualization Permissions (First Launch)

On first launch, macOS will prompt for:
- Virtualization framework access
- Select **Allow** to enable VM capabilities

The VM will start automatically and display:
```
Unified Multi-Service VM Ready
VM IP address: 192.168.64.X
```

---

## Service Access

Once the VM is running, all 4 services are immediately available:

### OpenVSCode (Web Code Editor)

**URL**: http://localhost:8080

**Features**:
- Full VS Code experience in browser
- Syntax highlighting for 50+ languages
- Built-in terminal
- File explorer
- Extensions support

**Access**:
```bash
# Open in browser
open http://localhost:8080

# Or manually navigate to: http://localhost:8080
```

### Valkey (In-Memory Database)

**Connection**: localhost:6379

**Test connection**:
```bash
# Using redis-cli (if installed)
redis-cli -p 6379 ping
# Returns: PONG

# Or using telnet
telnet localhost 6379
```

**Common commands**:
```bash
# Store data
SET key value

# Retrieve data
GET key

# List all keys
KEYS *

# Delete key
DEL key
```

### PostgreSQL (Relational Database)

**Connection**: localhost:5432

**Test connection**:
```bash
# Using psql
psql -h localhost -p 5432 -U postgres

# Or using psql without installation
brew install postgresql && psql -h localhost -p 5432 -U postgres
```

**Default credentials**:
- User: `postgres`
- Password: (no password required for local connections)
- Database: `postgres`

**Test query**:
```sql
SELECT version();
CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(100));
INSERT INTO test (name) VALUES ('VibeCode');
SELECT * FROM test;
```

### SSH Terminal Access

**Connection**: localhost:2222

**SSH into VM**:
```bash
# Connect
ssh -p 2222 root@localhost

# First time will ask to accept key fingerprint
# Type 'yes' and press Enter

# Once connected, you're in the VM shell
# You can manage services, check logs, etc.
```

**Useful SSH commands**:
```bash
# Check OpenVSCode status
systemctl status openvscode-server

# Check database status
pg_isready -h localhost

# View system info
uname -a
cat /etc/os-release

# Check service logs
journalctl -xe

# Exit SSH
exit
```

---

## Usage Examples

### Example 1: Create Database Table via OpenVSCode Terminal

1. Open http://localhost:8080 in browser
2. Click Terminal menu → New Terminal
3. Connect to PostgreSQL:
   ```bash
   psql -h localhost -U postgres
   ```
4. Create and populate table:
   ```sql
   CREATE TABLE projects (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   INSERT INTO projects (name) VALUES ('VibeCode');
   SELECT * FROM projects;
   ```

### Example 2: Use Valkey for Caching

1. Open terminal in OpenVSCode (or via SSH)
2. Start Redis CLI:
   ```bash
   redis-cli -p 6379
   ```
3. Store and retrieve data:
   ```
   > SET cache:user:1 '{"name": "Alice", "role": "admin"}'
   OK
   > GET cache:user:1
   "{\"name\": \"Alice\", \"role\": \"admin\"}"
   > INCR counter
   (integer) 1
   ```

### Example 3: Edit Files in OpenVSCode

1. Navigate to http://localhost:8080
2. Use the File Explorer on the left panel
3. Create new files or edit existing ones
4. Changes are saved automatically
5. Use built-in terminal to run commands

### Example 4: SSH and Manage Services

```bash
# Connect to VM
ssh -p 2222 root@localhost

# Check all services
systemctl list-units --type=service --all

# View OpenVSCode logs
journalctl -u openvscode-server -n 50

# Monitor resource usage
top

# Restart a service
systemctl restart openvscode-server

# Exit
exit
```

---

## Performance Metrics

The system is optimized for:

- **Boot Time**: ~25 seconds from app launch to VM ready
- **Memory Usage**: 1.5-2GB RAM (depends on workload)
- **CPU**: 4 vCPUs for responsive performance
- **Disk**: Minimal - all services in-memory where possible

---

## Troubleshooting

### Issue: OpenVSCode not accessible at localhost:8080

**Solution**:
1. Check if VM is running (look for "Unified Multi-Service VM Ready" message)
2. Wait 10-15 seconds for services to fully initialize
3. Check port forward by SSH into VM:
   ```bash
   ssh -p 2222 root@localhost
   netstat -tuln | grep 8080
   ```
4. If port is not listening, restart OpenVSCode:
   ```bash
   systemctl restart openvscode-server
   journalctl -u openvscode-server -n 20
   ```

### Issue: Cannot connect to PostgreSQL

**Solution**:
1. Verify PostgreSQL is running:
   ```bash
   ssh -p 2222 root@localhost
   pg_isready -h localhost
   ```
2. Check if port 5432 is forwarded:
   ```bash
   netstat -tuln | grep 5432
   ```
3. Restart PostgreSQL if needed:
   ```bash
   systemctl restart postgresql
   ```

### Issue: Valkey connection refused

**Solution**:
1. SSH into VM and check service:
   ```bash
   ssh -p 2222 root@localhost
   systemctl status valkey
   netstat -tuln | grep 6379
   ```
2. Restart Valkey:
   ```bash
   systemctl restart valkey
   ```

### Issue: VM won't start

**Solution**:
1. Check system requirements:
   - macOS 13.0+ (with Apple Silicon or Intel)
   - 4GB+ available RAM
   - 2GB free disk space
2. Check app permissions:
   - System Preferences → Security & Privacy → Allow VibeCode
3. Restart the app:
   - Force quit: Cmd+Option+Esc
   - Reopen app
4. Check logs (via SSH if VM partially starts):
   ```bash
   ssh -p 2222 root@localhost
   dmesg | tail -20
   journalctl -n 50 -p err
   ```

### Issue: Slow performance

**Solution**:
1. Check available system RAM:
   ```bash
   vm_stat  # Check free memory
   ```
2. Reduce background apps
3. Check VM resource usage:
   ```bash
   ssh -p 2222 root@localhost
   top -b -n 1
   ```
4. Check disk usage:
   ```bash
   df -h
   ```

---

## Advanced Configuration

### Connecting from Remote Machine

To access services from another computer on the network, set up port forwarding:

```bash
# Forward OpenVSCode through SSH tunnel
ssh -L 8080:localhost:8080 user@your-mac

# Forward PostgreSQL through SSH tunnel
ssh -L 5432:localhost:5432 user@your-mac

# Forward Valkey through SSH tunnel
ssh -L 6379:localhost:6379 user@your-mac

# Then connect locally:
# OpenVSCode: http://localhost:8080
# PostgreSQL: psql -h localhost -p 5432
# Valkey: redis-cli -p 6379
```

### Using in Docker Development

Mount VibeCode services into Docker containers:

```dockerfile
FROM ubuntu:22.04

# Connect to VibeCode services (from host network)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools

# Test connection
RUN psql -h host.docker.internal -p 5432 -U postgres -c "SELECT version();"
RUN redis-cli -h host.docker.internal -p 6379 ping
```

### Monitoring Services

Monitor all 4 services simultaneously:

```bash
# SSH into VM
ssh -p 2222 root@localhost

# Create a monitoring script
cat > /tmp/monitor.sh << 'EOF'
#!/bin/bash
while true; do
    clear
    echo "=== VibeCode Services Status ==="
    systemctl status openvscode-server | grep Active
    pg_isready -h localhost
    redis-cli -p 6379 ping
    echo "================================"
    sleep 5
done
EOF

chmod +x /tmp/monitor.sh
/tmp/monitor.sh
```

---

## System Requirements

| Component | Requirement |
|-----------|-------------|
| macOS Version | 13.0 or newer |
| Processor | Apple Silicon (M1+) or Intel (2017+) |
| RAM | 4GB minimum, 8GB+ recommended |
| Free Disk Space | 2GB minimum |
| Network | Internet for initial setup |

---

## File Locations

Inside the VM:

- **OpenVSCode Config**: `/root/.config/openvscode-server/`
- **PostgreSQL Data**: `/var/lib/postgresql/16/main/`
- **Valkey Data**: `/var/lib/valkey/`
- **SSH Config**: `/etc/ssh/sshd_config`
- **System Logs**: `/var/log/` or via `journalctl`

---

## Uninstallation

To completely remove VibeCode:

```bash
# Quit application if running
killall VibeCode

# Remove application
rm -rf /Applications/VibeCode.app

# Optional: Remove configuration
rm -rf ~/.config/VibeCode
rm -rf ~/Library/Application\ Support/VibeCode
rm -rf ~/Library/Caches/VibeCode

# Remove DMG
rm ~/Downloads/VibeCode-Unified-v3.0.0-FINAL.dmg
```

---

## Support and Resources

### Getting Help

1. **Check Console Output**
   - Watch the main app window during startup
   - Look for error messages or status updates

2. **SSH into VM for Diagnostics**
   ```bash
   ssh -p 2222 root@localhost
   journalctl -n 100
   systemctl status
   ```

3. **Check Network Connectivity**
   ```bash
   # From macOS
   netstat -an | grep 8080
   lsof -i :8080
   ```

### Documentation

- [OpenVSCode Documentation](https://github.com/gitpod-io/openvscode-server)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Valkey Documentation](https://valkey.io/docs/)

---

## What's New in v3.0.0

✅ **Unified Multi-Service VM**: All services integrated in single, fast boot
✅ **Performance Optimized**: 25-second boot time with all services
✅ **Stable Networking**: Fixed DHCP + IPv4 reliability
✅ **Full Terminal Access**: SSH into VM for complete control
✅ **Production Ready**: Tested across 24+ agent iterations
✅ **Easy Installation**: Standard macOS DMG installation

---

## Feedback

If you encounter issues or have suggestions:

1. Test connectivity to each service individually
2. SSH into VM and check logs: `journalctl -xe`
3. Verify all ports are properly forwarded
4. Check available system resources

---

**Version**: 3.0.0
**Release Date**: January 2026
**Status**: Production Ready
**Size**: 94 MB DMG
**Boot Time**: ~25 seconds

---

## Quick Reference Card

```
┌─────────────────────────────────────────┐
│       VibeCode Unified v3.0.0           │
├─────────────────────────────────────────┤
│ 1. Mount DMG and install app            │
│ 2. Launch VibeCode.app                  │
│ 3. Wait for VM startup (~25 seconds)    │
│ 4. Access services:                     │
│    - OpenVSCode: http://localhost:8080  │
│    - PostgreSQL: localhost:5432         │
│    - Valkey: localhost:6379             │
│    - SSH: ssh -p 2222 root@localhost    │
└─────────────────────────────────────────┘

Services Status:
┌─────────────────────────────────────────┐
│ Service         Port    Status           │
├─────────────────────────────────────────┤
│ OpenVSCode      8080    Web Browser      │
│ PostgreSQL      5432    Database         │
│ Valkey          6379    Cache/DB         │
│ SSH             2222    Terminal         │
└─────────────────────────────────────────┘
```

---

End of User Guide
