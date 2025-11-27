# SSH Server Quick Reference Guide

## Quick Start

### 1. Launch the VM
```bash
open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app
```

Wait ~30 seconds for boot and SSH server startup.

### 2. Connect via SSH
```bash
# Direct connection
ssh root@192.168.64.3
# Password: vibecode

# Or with sshpass (no password prompt)
sshpass -p vibecode ssh root@192.168.64.3
```

### 3. Create SSH Tunnel for OpenVSCode
```bash
# Create tunnel in background
ssh -L 3000:localhost:3000 -N -f root@192.168.64.3
# Password: vibecode

# Access OpenVSCode
open http://localhost:3000
```

---

## Credentials

- **IP Address**: 192.168.64.3
- **Port**: 22
- **Username**: root
- **Password**: vibecode

---

## Common Commands

### Check if SSH is running in VM
```bash
sshpass -p vibecode ssh root@192.168.64.3 "ps | grep dropbear"
```

### Check OpenVSCode status
```bash
sshpass -p vibecode ssh root@192.168.64.3 "ps | grep bun"
```

### View VM network configuration
```bash
sshpass -p vibecode ssh root@192.168.64.3 "ip addr show"
```

### Check running processes
```bash
sshpass -p vibecode ssh root@192.168.64.3 "ps aux"
```

### Restart OpenVSCode (if needed)
```bash
sshpass -p vibecode ssh root@192.168.64.3 "pkill -9 bun"
# Note: VM will need restart
```

---

## Troubleshooting

### SSH Connection Refused
```bash
# Check if VM is running
ps aux | grep BasicVibeCode

# Check VM console log
ls -lt /tmp/vibecode-console-*.log | head -1
tail -50 /tmp/vibecode-console-*.log
```

### Tunnel Not Working
```bash
# Kill existing tunnels
pkill -f "ssh.*3000"

# Recreate tunnel
sshpass -p vibecode ssh -L 3000:localhost:3000 -N -f root@192.168.64.3

# Test tunnel
curl http://localhost:3000
```

### Check SSH Server Logs
```bash
# View VM console for SSH startup messages
grep -A 20 "SSH Server" /tmp/vibecode-console-*.log
```

---

## File Locations

### On macOS Host

- **App Bundle**: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app`
- **Initramfs Source**: `/Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-ssh.cpio.gz`
- **Build Script**: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/bundle-apps.sh`
- **Console Logs**: `/tmp/vibecode-console-*.log`

### Inside VM (via SSH)

- **SSH Server**: `/usr/sbin/dropbear`
- **Key Generator**: `/usr/bin/dropbearkey`
- **Host Keys**: `/etc/dropbear/dropbear_*_host_key`
- **Init Script**: `/init`
- **Bun Binary**: `/opt/bun-linux-aarch64/bun`
- **OpenVSCode**: `/opt/openvscode/`

---

## Advanced Usage

### SSH with X11 Forwarding (if needed)
```bash
ssh -X root@192.168.64.3
```

### Multiple Port Forwards
```bash
ssh -L 3000:localhost:3000 -L 8080:localhost:8080 -N -f root@192.168.64.3
```

### SCP File Transfer
```bash
# Copy file to VM
scp file.txt root@192.168.64.3:/tmp/

# Copy file from VM
scp root@192.168.64.3:/tmp/file.txt ./
```

### SOCKS Proxy through VM
```bash
ssh -D 9050 -N -f root@192.168.64.3
# Configure browser to use SOCKS5 proxy localhost:9050
```

---

## Security Notes

1. **Default Password**: Change `vibecode` password for production use
2. **Host Keys**: Generated on first boot, persist in /etc/dropbear
3. **Root Access**: Full root access granted - use carefully
4. **Network**: VM only accessible from host on private network
5. **Blank Passwords**: Enabled with `-B` flag for emergency access

---

## Performance Tips

1. **Compression**: SSH compression enabled by default (libz)
2. **KeepAlive**: Add `-o ServerAliveInterval=60` for stable tunnels
3. **Connection Reuse**: Use `ControlMaster` for faster subsequent connections

Example:
```bash
ssh -o ControlMaster=auto -o ControlPath=/tmp/ssh-%r@%h:%p root@192.168.64.3
```

---

## Integration with Development Workflow

### VSCode Remote
1. Create SSH tunnel: `ssh -L 3000:localhost:3000 -N -f root@192.168.64.3`
2. Open VSCode
3. Access: http://localhost:3000

### Automated Startup Script
```bash
#!/bin/bash
# start-vibecode.sh

# Launch VM
open /path/to/BasicVibeCode.app

# Wait for boot
sleep 30

# Create tunnel
sshpass -p vibecode ssh -L 3000:localhost:3000 -N -f root@192.168.64.3

# Open browser
open http://localhost:3000

echo "VibeCode ready!"
```

---

## Related Documentation

- Full Implementation Report: `SSH_SERVER_IMPLEMENTATION_REPORT.md`
- Build Instructions: See bundle-apps.sh comments
- VM Architecture: See system overview documentation
