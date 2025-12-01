# Quick-Start Guide: SSH Access to OpenVSCode

🚀 Access OpenVSCode running in BasicVibeCode.app via SSH tunnel in under 5 minutes!

## Prerequisites Check ✅

Before you begin, verify:

- **macOS Version**: 10.15 or later
- **BasicVibeCode.app**: Located in `/Applications/BasicVibeCode.app`
- **Network**: WiFi or Ethernet connected
- **SSH Client**: Pre-installed on macOS

```bash
# Verify SSH is available
which ssh
```

## Step-by-Step Instructions

### Step 1: Launch BasicVibeCode.app
Open Applications folder and double-click **BasicVibeCode.app**, or use:

```bash
open /Applications/BasicVibeCode.app
```

✅ You'll see a window appear (don't close it!)

### Step 2: Wait for VM Boot
The VM takes ~30 seconds to fully boot. You can monitor progress by checking System Settings → Network. Wait until you see the VM's network interface appear.

### Step 3: Connect via SSH
Open Terminal and connect to the VM:

```bash
ssh root@192.168.64.3
```

When prompted for password, enter: `vibecode`

✅ You should see a shell prompt inside the VM

### Step 4: Create SSH Tunnel
From your Mac, create a local port forward to OpenVSCode:

```bash
ssh -L 3000:localhost:3000 root@192.168.64.3
```

Enter password: `vibecode`

💡 This tunnels VM's port 3000 → your Mac's port 3000

### Step 5: Access OpenVSCode
Open your web browser and navigate to:

```
http://localhost:3000
```

✅ OpenVSCode loads in your browser!

---

## One-Liner Commands

### Quick SSH Tunnel (Recommended)
```bash
ssh -L 3000:localhost:3000 root@192.168.64.3
```

### Quick SSH Connection
```bash
ssh root@192.168.64.3
```

### Background SSH Tunnel
```bash
ssh -N -L 3000:localhost:3000 root@192.168.64.3 &
```

### Verify VM IP
```bash
arp-scan --localnet | grep -i "vibecode\|qemu"
```

---

## Troubleshooting

### ❌ "SSH: Connection refused" on 192.168.64.3

**Solution 1**: Verify the VM IP:
```bash
# Inside VM terminal
ifconfig eth0 | grep "inet "
```

**Solution 2**: Restart BasicVibeCode.app:
```bash
killall -9 qemu-system-x86_64
sleep 2
open /Applications/BasicVibeCode.app
sleep 30  # Wait for boot
```

### ❌ VM Not Getting IP Address

**Steps**:
1. Restart BasicVibeCode.app
2. Check macOS network settings
3. Ensure Dropbear SSH daemon is running in VM:
   ```bash
   ps aux | grep dropbear
   ```

### ❌ Port 3000 Already in Use

**Find and kill process**:
```bash
lsof -i :3000
kill -9 <PID>
```

**Alternative**: Use different port:
```bash
ssh -L 3001:localhost:3000 root@192.168.64.3
```
Then access `http://localhost:3001`

### ❌ "Password authentication failed"

**Verify credentials**:
- Username: `root`
- Password: `vibecode`
- Host: `192.168.64.3`

If issue persists, restart Dropbear in VM:
```bash
ssh root@192.168.64.3
/etc/init.d/dropbear restart
```

---

## Advanced Usage

### Using SSH Keys (No Password)

Generate key on Mac:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/vibecode_key
```

Copy public key to VM:
```bash
ssh-copy-id -i ~/.ssh/vibecode_key.pub root@192.168.64.3
```

Connect without password:
```bash
ssh -i ~/.ssh/vibecode_key -L 3000:localhost:3000 root@192.168.64.3
```

### Keep Tunnel Running in Background

```bash
# Start background tunnel
nohup ssh -N -L 3000:localhost:3000 root@192.168.64.3 > /tmp/ssh-tunnel.log 2>&1 &

# Check tunnel status
ps aux | grep ssh

# Kill tunnel when done
pkill -f "ssh -N -L 3000:localhost:3000"
```

### Access from Remote Machine

From another computer on your network, use your Mac as a proxy:

```bash
# On remote machine
ssh -L 3000:localhost:3000 youruser@your-mac-ip
```

Then access `http://localhost:3000` on the remote machine.

---

## Network Architecture

```
┌─────────────────────────────────────────────────────┐
│ Your Mac (macOS)                                    │
│ ┌──────────────────────────────────────────────┐   │
│ │ Terminal                                     │   │
│ │ ssh -L 3000:localhost:3000 \                │   │
│ │     root@192.168.64.3                        │   │
│ └──────────────────────────────────────────────┘   │
│          │                                          │
│          │ SSH Tunnel (encrypted)                   │
│          │                                          │
│ ┌──────────────────────────────────────────────┐   │
│ │ Browser (localhost:3000)                     │   │
│ │ Opens OpenVSCode UI                          │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
          │ Virtual Network
          │
┌─────────────────────────────────────────────────────┐
│ Linux VM (192.168.64.3)                             │
│ ┌──────────────────────────────────────────────┐   │
│ │ Dropbear SSH Server (port 22)                │   │
│ │ ├─ Root user: vibecode                       │   │
│ │ └─ OpenVSCode (port 3000)                    │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Connection Flow

```
[Step 1] Launch BasicVibeCode.app
           ↓
[Step 2] Wait 30 seconds for VM boot
           ↓
[Step 3] VM boots → Dropbear SSH runs
           ↓
[Step 4] Mac Terminal: ssh -L 3000:localhost:3000 root@192.168.64.3
           ↓
[Step 5] Enter password: vibecode
           ↓
[Step 6] SSH tunnel established
           ↓
[Step 7] Browser: http://localhost:3000
           ↓
✅ OpenVSCode ready!
```

---

## FAQ

**Q: Do I need to keep the SSH terminal window open?**
A: Yes, keep it open for the tunnel to remain active. Use `&` or `nohup` to background it.

**Q: Can I access OpenVSCode while SSHed into the VM?**
A: Yes! Once connected, you can use `curl http://localhost:3000` inside the VM.

**Q: Is the SSH tunnel encrypted?**
A: Yes, SSH provides end-to-end encryption for all traffic.

**Q: What if I forget the password?**
A: The default password is `vibecode`. If changed, update it in the VM config.

**Q: Can I use this over the internet?**
A: Not directly (VM is local). Set up a VPN or reverse proxy for remote access.

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review VM logs: `/var/log/dropbear`
3. Verify OpenVSCode is running: `curl http://localhost:3000` inside VM

---

**Last Updated**: November 26, 2025
**Version**: 1.0
