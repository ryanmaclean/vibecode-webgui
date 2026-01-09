# VibeCode Unified v3.0.0 - Quick Start Guide

**Get started in 3 minutes**

## 1. Install (1 minute)

```bash
# Download DMG
cd ~/Downloads

# Mount DMG (double-click or terminal)
hdiutil attach VibeCode-Unified-v3.0.0-FINAL.dmg

# Copy to Applications
cp -r "/Volumes/VibeCode Unified/VibeCode.app" /Applications/

# Eject
hdiutil detach "/Volumes/VibeCode Unified"
```

## 2. Launch (30 seconds)

```bash
# Open from Spotlight
# Cmd+Space → Type "VibeCode" → Enter

# Or terminal
open /Applications/VibeCode.app
```

## 3. Wait & Connect (1.5 minutes)

Watch the app console until you see:
```
Unified Multi-Service VM Ready
VM IP address: 192.168.64.X
```

Then access services:

### OpenVSCode IDE
```
Browser: http://localhost:8080
```

### PostgreSQL Database
```bash
psql -h localhost -p 5432 -U postgres
```

### Valkey Cache
```bash
redis-cli -p 6379
```

### SSH Terminal
```bash
ssh -p 2222 root@localhost
```

---

## Verification (30 seconds)

```bash
# Test all services
curl -s http://localhost:8080 | head -5
psql -h localhost -p 5432 -U postgres -c "SELECT 1;"
redis-cli -p 6379 ping
ssh -p 2222 root@localhost "echo OK"
```

Expected output:
```
<!DOCTYPE html>  (OpenVSCode HTML)
 1                (PostgreSQL)
PONG              (Valkey)
OK                (SSH)
```

---

## What You Get

| Service | Port | Access | Purpose |
|---------|------|--------|---------|
| OpenVSCode | 8080 | http://localhost:8080 | Code editor |
| PostgreSQL | 5432 | localhost:5432 | Database |
| Valkey | 6379 | localhost:6379 | Cache/Queue |
| SSH | 2222 | ssh -p 2222 root@localhost | Terminal |

---

## First 5 Tests

### Test 1: Edit a File
1. Open http://localhost:8080
2. Click "New File"
3. Type code
4. Save (Ctrl+S)

### Test 2: Create Database Table
```bash
psql -h localhost -p 5432 -U postgres << 'EOF'
CREATE TABLE demo (id INT, name TEXT);
INSERT INTO demo VALUES (1, 'VibeCode');
SELECT * FROM demo;
EOF
```

### Test 3: Cache Some Data
```bash
redis-cli -p 6379 << 'EOF'
SET app:name "VibeCode"
SET app:version "3.0.0"
INCR app:launches
LRANGE app:launches 0 -1
EOF
```

### Test 4: SSH into VM
```bash
ssh -p 2222 root@localhost
# Inside VM:
systemctl status openvscode-server
top  # (press q to exit)
exit
```

### Test 5: Terminal in OpenVSCode
1. Open http://localhost:8080
2. Press Ctrl+` to open terminal
3. Run: `redis-cli -p 6379 ping`
4. Should output: `PONG`

---

## Troubleshooting Quick Fixes

### Services not starting
→ Wait 45 seconds, services can take time

### Cannot access localhost:8080
→ SSH into VM: `ssh -p 2222 root@localhost`
→ Check service: `systemctl status openvscode-server`

### PostgreSQL won't connect
→ Check it's running: `pg_isready -h localhost`
→ Verify port: `netstat -tuln | grep 5432`

### General issues
→ Restart app
→ Kill any remaining processes: `pkill -f virtualization`
→ Try again

---

## File Locations

**macOS**:
- App: `/Applications/VibeCode.app`
- Downloads: `~/Downloads/VibeCode-Unified-v3.0.0-FINAL.dmg`

**Inside VM** (via SSH):
- OpenVSCode config: `/root/.config/openvscode-server/`
- PostgreSQL data: `/var/lib/postgresql/16/main/`
- Valkey data: `/var/lib/valkey/`
- System logs: `journalctl` or `/var/log/`

---

## Common Commands

### Database
```bash
# Connect
psql -h localhost -p 5432 -U postgres

# Create table
CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);

# Insert data
INSERT INTO users (name) VALUES ('Alice');

# Query
SELECT * FROM users;
```

### Cache
```bash
# Connect
redis-cli -p 6379

# Store
SET key value

# Retrieve
GET key

# Increment counter
INCR counter

# List operations
LPUSH queue item
LRANGE queue 0 -1
```

### SSH
```bash
# Connect
ssh -p 2222 root@localhost

# Check services
systemctl status

# View logs
journalctl -n 50

# Monitor resources
top

# Exit
exit
```

### Code Editor
- Ctrl+P → Open file
- Ctrl+F → Find
- Ctrl+H → Replace
- Ctrl+` → Terminal
- Ctrl+, → Settings
- Ctrl+Shift+X → Extensions

---

## Performance Baseline

- **Boot Time**: 25 seconds (app launch to ready)
- **Memory**: 1.5-2 GB RAM in use
- **CPU**: 4 vCores allocated
- **Disk**: All services in-memory (no disk usage)

---

## Next Steps

1. **Explore OpenVSCode**: Create a project
2. **Try PostgreSQL**: Build a schema
3. **Use Valkey**: Cache some data
4. **SSH Around**: Explore the VM
5. **Read Full Guide**: See VIBECODE-FINAL-USAGE-GUIDE.md

---

## Getting Help

### Full Documentation
- Installation: `VIBECODE-INSTALLATION-GUIDE.md`
- Usage: `VIBECODE-FINAL-USAGE-GUIDE.md`
- Verification: `VIBECODE-VERIFICATION-PROOF.md`

### Verification Script
```bash
# Test all 4 services at once
./verify-vibecode.sh
```

### Direct Support
SSH into the VM and check logs:
```bash
ssh -p 2222 root@localhost
journalctl -xe  # Detailed system logs
systemctl status  # Service status
```

---

**Ready to go? Launch VibeCode now!**

```bash
open /Applications/VibeCode.app
```

Enjoy!
