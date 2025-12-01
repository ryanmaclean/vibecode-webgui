# VibeCode VM Quick Reference

## Launch Commands

```bash
# Valkey
open ~/vibecode-webgui/azure/SwiftUI-Apps/ValkeyVibeCode.app

# PostgreSQL
open ~/vibecode-webgui/azure/SwiftUI-Apps/PostgreSQLVibeCode.app

# Unified
open ~/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode.app

# Node.js
open ~/vibecode-webgui/azure/SwiftUI-Apps/NodeJSVibeCode.app
```

## Access Commands

```bash
# Valkey (wait 30s)
redis-cli -h 192.168.64.3 -p 6379 PING

# PostgreSQL (wait 60s)
psql -h 192.168.64.3 -U postgres

# OpenVSCode
open http://192.168.64.3:8080

# Node.js
curl http://192.168.64.3:3000
```

## Troubleshooting

```bash
# View console
tail -f /tmp/vibecode-console-*.log

# Find VM IP
tail -100 /tmp/vibecode-console-*.log | grep "inet "

# Scan ports
nmap 192.168.64.3

# Kill VM
killall NodeJSVibeCode ValkeyVibeCode
```

## Build & Test

```bash
# Build all
bash ~/vibecode-webgui/scripts/build-all-vms.sh

# Test all
bash ~/vibecode-webgui/scripts/test-specialized-vms.sh

# Deploy
bash ~/vibecode-webgui/scripts/deploy-vm.sh <name> <initramfs>
```

