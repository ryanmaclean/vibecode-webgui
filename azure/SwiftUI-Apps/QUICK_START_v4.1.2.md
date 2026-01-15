# VibeCode Unified v4.1.2 - Quick Start Guide

## What's New in v4.1.2
- Fixed Issue #790: OpenVSCode terminal PATH issue
- All Unix commands now work in OpenVSCode terminal (`ls`, `cat`, `grep`, etc.)
- Settings.json automatically created with correct PATH configuration

## Installation
```bash
# Mount DMG and drag to Applications
open VibeCode-Unified-v4.1.2.dmg

# Or install from command line
hdiutil attach VibeCode-Unified-v4.1.2.dmg
cp -R "/Volumes/VibeCode Unified v4.1.2/UnifiedServicesVibeCodeApp.app" /Applications/
hdiutil detach "/Volumes/VibeCode Unified v4.1.2"
```

## Launch
```bash
# Launch from Applications
open /Applications/UnifiedServicesVibeCodeApp.app

# Or launch from command line
/Applications/UnifiedServicesVibeCodeApp.app/Contents/MacOS/UnifiedServicesVibeCodeApp
```

## Services
All services are accessible on localhost:

| Service     | Port | URL                         | Notes                    |
|-------------|------|-----------------------------|--------------------------|
| SSH         | 2222 | ssh://localhost:2222        | user: root, pass: vibecode |
| OpenVSCode  | 8080 | http://localhost:8080       | Web IDE                  |
| Valkey      | 6379 | redis://localhost:6379      | Redis-compatible         |
| PostgreSQL  | 5432 | postgresql://localhost:5432 | user: postgres           |
| Docker      | 2375 | tcp://localhost:2375        | Docker Engine API        |

## Quick Tests

### Test All Services
```bash
nc -z localhost 2222 && echo "SSH: ✓"
nc -z localhost 8080 && echo "OpenVSCode: ✓"
nc -z localhost 6379 && echo "Valkey: ✓"
nc -z localhost 5432 && echo "PostgreSQL: ✓"
nc -z localhost 2375 && echo "Docker: ✓"
```

### SSH Access
```bash
# Connect via SSH
sshpass -p vibecode ssh -p 2222 root@localhost

# Or without password prompt
ssh root@localhost -p 2222
# Enter password: vibecode
```

### OpenVSCode Terminal Test
1. Open browser: http://localhost:8080
2. Open terminal: Terminal → New Terminal
3. Test commands:
   ```bash
   ls /tmp
   cat /etc/hostname
   grep PATH /tmp/vscode-data/Machine/settings.json
   pwd
   cd /opt && ls
   ```

### Valkey Test
```bash
# Connect to Valkey
redis-cli -p 6379

# Test commands
127.0.0.1:6379> PING
PONG
127.0.0.1:6379> SET test "hello"
OK
127.0.0.1:6379> GET test
"hello"
```

### PostgreSQL Test
```bash
# Connect to PostgreSQL
psql -h localhost -p 5432 -U postgres

# Test commands
postgres=# SELECT version();
postgres=# \l
postgres=# \q
```

### Docker Test
```bash
# Set Docker host
export DOCKER_HOST=tcp://localhost:2375

# Test Docker
docker version
docker ps
docker images
```

## Troubleshooting

### VM Not Starting
```bash
# Check if app is running
ps aux | grep UnifiedServicesVibeCodeApp

# Kill and restart
killall UnifiedServicesVibeCodeApp
open /Applications/UnifiedServicesVibeCodeApp.app
```

### Services Not Accessible
```bash
# Wait for boot (15-30 seconds)
sleep 30

# Check services again
nc -z localhost 2222 && echo "SSH: ✓" || echo "SSH: ✗"
```

### OpenVSCode Terminal Commands Not Working
This should be fixed in v4.1.2. If you still have issues:

1. Check settings.json exists:
   ```bash
   sshpass -p vibecode ssh -p 2222 root@localhost "cat /tmp/vscode-data/Machine/settings.json"
   ```

2. Verify PATH is set:
   ```bash
   sshpass -p vibecode ssh -p 2222 root@localhost "grep PATH /tmp/vscode-data/Machine/settings.json"
   ```

## Build Info
- **Version**: 4.1.2
- **Build Date**: 2026-01-15
- **Size**: 584MB
- **SHA256**: `7adf89e26a0beba4516b3773b7ee5e7a7b0db773902e7c3712333751107883af`

## Files
- App: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app`
- DMG: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/VibeCode-Unified-v4.1.2.dmg`
- Initramfs: `/Users/ryan.maclean/vibecode-webgui/azure/unified-services-static.cpio.gz`

## Next Steps
1. Test the DMG installation
2. Verify all services work
3. Test OpenVSCode terminal commands
4. If all tests pass: `./publish-release.sh 4.1.2`
