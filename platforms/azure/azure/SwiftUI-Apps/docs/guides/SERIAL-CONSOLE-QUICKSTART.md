# Serial Console Quick Start

## Quick Reference

### 1. Start the VM
```bash
./BasicVibeCodeApp
```

### 2. Find the PTY Path
Look for output like:
```
===========================================
Interactive console available at: /dev/ttys001
Connect using: screen /dev/ttys001
Or use: socat - /dev/ttys001,raw,echo=0
===========================================
```

### 3. Connect to the Console

**Option A: Using screen (recommended)**
```bash
screen /dev/ttys001
```
Exit: `Ctrl-A` then `k`

**Option B: Using socat**
```bash
socat - /dev/ttys001,raw,echo=0
```
Exit: `Ctrl-C`

**Option C: Using cu**
```bash
cu -l /dev/ttys001
```
Exit: Type `~.`

### 4. Interact with the VM
Once connected, you can run commands:
```bash
# Press Enter to see prompt
<Enter>

# Check system info
uname -a

# View processes
ps aux

# Check network
ip addr show

# Test OpenVSCode server
curl http://localhost:3000
```

## One-Liner Commands

Send a single command without interactive session:
```bash
echo "uname -a" > /dev/ttys001
```

Watch console output:
```bash
tail -f /tmp/vibecode-console.log
```

## Troubleshooting

**"Permission denied"**: Run as the same user who started the app

**"Device not configured"**: The VM is not running

**No output**: Press Enter to wake the console

**PTY changed**: Check the app output for the current PTY path

## Example Session

```bash
# Terminal 1: Start the app
./BasicVibeCodeApp

# Terminal 2: Connect to console
screen /dev/ttys001

# Inside VM console:
/ # uname -a
Linux localhost 6.1.0 #1 SMP Wed Jul 12 18:38:00 UTC 2023 aarch64 Linux

/ # ps aux | grep openvscode
  123 root      0:02 node /usr/local/bin/openvscode-server

/ # netstat -tlnp | grep 3000
tcp        0      0 :::3000                 :::*                    LISTEN      123/node

/ # exit

# Back to terminal
[screen is terminating]
```

For detailed documentation, see SERIAL-CONSOLE-GUIDE.md
