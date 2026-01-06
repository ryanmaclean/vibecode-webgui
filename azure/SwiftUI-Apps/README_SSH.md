# SSH Tunnel - Quick Reference

## Overview
Access OpenVSCode (running on VM's 127.0.0.1:3000) from host via SSH tunnel.

## Files

```
/Users/ryan.maclean/vibecode-webgui/azure/
├── bun-openvscode-with-ssh.cpio.gz          # SSH-enabled initramfs (108MB)
│
└── SwiftUI-Apps/
    ├── scripts/
    │   ├── tunnel-to-vm.sh                  # Creates SSH tunnel
    │   └── rebuild-bundle-with-ssh.sh       # Updates bundle with SSH initramfs
    │
    └── Documentation/
        ├── QUICKSTART_SSH.md                # 5-minute setup guide
        ├── SSH_TUNNEL_SETUP.md              # Comprehensive guide
        └── SSH_SETUP_SUMMARY.md             # Implementation details
```

## Quick Commands

```bash
# 1. Update bundle with SSH support (if already built)
./scripts/rebuild-bundle-with-ssh.sh

# 2. Start VM
open DatadogDevMenu.app

# 3. Get VM IP from logs
./scripts/view-vm-logs.sh | grep "DHCP successful"
# Example output: DHCP successful: 192.168.64.3/24

# 4. Create tunnel
./scripts/tunnel-to-vm.sh 192.168.64.3
# Password: password

# 5. Access OpenVSCode
# Open browser: http://localhost:3000
```

## Default Credentials
- **Username:** root
- **Password:** password
- **SSH Port:** 22
- **OpenVSCode Port:** 3000 (via tunnel)

## Status Checks

```bash
# Check if VM is reachable
ping -c 1 192.168.64.3

# Check if SSH is running
nc -z 192.168.64.3 22

# Check VM logs
./scripts/view-vm-logs.sh

# Check for SSH server startup
./scripts/view-vm-logs.sh | grep -i dropbear

# Check for OpenVSCode startup
./scripts/view-vm-logs.sh | grep "Starting OpenVSCode"
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| VM not reachable | Wait 30s for boot, check logs |
| SSH refused | Wait for "Dropbear SSH server started" in logs |
| Can't access localhost:3000 | Keep SSH terminal open, verify tunnel active |
| Wrong password | Default is "password" (lowercase, no quotes) |

## Documentation

- **Quick Start:** [QUICKSTART_SSH.md](./QUICKSTART_SSH.md)
- **Full Guide:** [SSH_TUNNEL_SETUP.md](./SSH_TUNNEL_SETUP.md)
- **Implementation:** [SSH_SETUP_SUMMARY.md](./SSH_SETUP_SUMMARY.md)

## Integration with Build Process

### Option 1: Modify build script
Edit `build-apps.sh` to use `bun-openvscode-with-ssh.cpio.gz` instead of `bun-openvscode-with-modules.cpio.gz`

### Option 2: Manual copy after build
```bash
cp /Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-ssh.cpio.gz \
   DatadogDevMenu.app/Contents/Resources/initrd
```

## What's Included

The SSH-enabled initramfs adds:
- Dropbear SSH server (lightweight, secure)
- Required crypto libraries
- Auto-start on boot
- Root access with password authentication
- Host key generation

## Security Note

Default password is `password` for development convenience.
**Change this for production use!**

See [SSH_TUNNEL_SETUP.md](./SSH_TUNNEL_SETUP.md#security-notes) for hardening instructions.
