# Code-Server VM - Quick Start Guide

Get up and running with Code-Server VM in under 30 minutes.

## TL;DR

```bash
# Build the VM image (10-20 minutes)
~/vibecode-webgui/azure/build-code-server.py

# Run the VM (5-10 seconds to boot)
vfkit \
  --cpus 2 \
  --memory 1024 \
  --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw \
  --initrd ~/vibecode-webgui/azure/code-server-initramfs.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:61 \
  --device virtio-rng

# Open browser to http://<VM-IP>:8080
```

## Step-by-Step

### Step 1: Build the VM Image

```bash
# Navigate to the directory
cd ~/vibecode-webgui/azure

# Run the build script
./build-code-server.py
```

**What happens**:
- Downloads Code-Server (114 MB)
- Downloads Node.js musl build (40 MB)
- Downloads BusyBox (1 MB)
- Creates minimal Alpine rootfs
- Strips binaries
- Packages into compressed initramfs
- Output: `code-server-initramfs.cpio.gz` (~38 MB)

**Time**: 10-20 minutes (depends on internet speed)

### Step 2: Verify the Build

```bash
# Check output file exists
ls -lh ~/vibecode-webgui/azure/code-server-initramfs.cpio.gz

# Should show ~30-40 MB file
```

### Step 3: Run the VM

```bash
vfkit \
  --cpus 2 \
  --memory 1024 \
  --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw \
  --initrd ~/vibecode-webgui/azure/code-server-initramfs.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:61 \
  --device virtio-rng
```

**Time**: 5-10 seconds to boot

### Step 4: Find the IP Address

Watch the console output for:
```
[2/6] Configuring network...
  Found interface: eth0
  IP Address: 192.168.64.5
```

### Step 5: Access Code-Server

Open your browser to:
```
http://192.168.64.5:8080
```

Replace `192.168.64.5` with the IP shown in the console.

## Console Output Example

```
========================================
  Code-Server VM (Alpine ARM64)
  Version: 4.105.1
========================================

[1/6] Mounting filesystems...
[2/6] Configuring network...
  Found interface: eth0
  IP Address: 192.168.64.5
[3/6] Setting up environment...
[4/6] Configuring Code-Server...
  Configuration:
    Port: 8080
    Auth: disabled (development mode)
    Data dir: /home/coder/.local/share/code-server

[5/6] Starting Code-Server...
========================================
  Code-Server is starting...
  Access URL: http://192.168.64.5:8080

  Features:
    - VSIX extension support
    - Built-in terminal
    - LSP ready
    - MCP ready
    - RAG integration capable

  Press Ctrl+C to stop
========================================

[6/6] Launching Code-Server...
[2025-10-29T21:30:45.123Z] info  code-server 4.105.1 on http://0.0.0.0:8080
[2025-10-29T21:30:45.234Z] info  - No authentication
[2025-10-29T21:30:45.345Z] info  - Not serving HTTPS
```

## First Steps in Code-Server

### 1. Open Terminal

Click the hamburger menu → Terminal → New Terminal

### 2. Install Extensions

Click the Extensions icon (or Ctrl+Shift+X):
- Search for "Python"
- Click "Install"

### 3. Open/Create Files

Click File → Open File or Create New File

### 4. Use Built-in Features

- IntelliSense (autocomplete)
- Syntax highlighting
- Integrated terminal
- Git integration
- Search and replace
- Multi-cursor editing

## Common Commands

### Stop the VM

```bash
# In the vfkit console
Press Ctrl+C
```

### Rebuild the Image

```bash
# Delete old image
rm ~/vibecode-webgui/azure/code-server-initramfs.cpio.gz

# Build again
~/vibecode-webgui/azure/build-code-server.py
```

### Change Memory

```bash
# Edit vfkit command
--memory 2048  # Use 2 GB instead of 1 GB
```

### Change Port

Edit `build-code-server.py` line 312:
```python
bind-addr: 0.0.0.0:3000  # Change to port 3000
```

Then rebuild.

## Troubleshooting

### "Cannot download Code-Server"

**Solution**: Check internet connection, try again

### "Initramfs file not found"

**Solution**: Check build completed successfully, look for errors

### "VM won't boot"

**Solution**:
1. Verify kernel exists: `ls ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw`
2. Check memory: Use at least 512 MB
3. Check vfkit installation: `which vfkit`

### "Cannot access Code-Server in browser"

**Solution**:
1. Check VM is running
2. Verify IP address from console
3. Try: `curl http://<VM-IP>:8080`
4. Check firewall settings

### "Code-Server is slow"

**Solution**:
1. Increase memory: `--memory 2048`
2. Increase CPUs: `--cpus 4`
3. Close unused extensions
4. Disable telemetry (already done)

## Tips

### Use Screen/Tmux

To keep VM running in background:
```bash
# Install screen
brew install screen

# Start screen session
screen

# Run vfkit
vfkit ...

# Detach: Ctrl+A, D
# Reattach: screen -r
```

### Auto-start on Boot

Create a Launch Agent (macOS):
```bash
# Create plist file
cat > ~/Library/LaunchAgents/com.codeserver.vm.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.codeserver.vm</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/vfkit</string>
        <string>--cpus</string>
        <string>2</string>
        <string>--memory</string>
        <string>1024</string>
        <string>--kernel</string>
        <string>/Users/YOUR_USERNAME/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw</string>
        <string>--initrd</string>
        <string>/Users/YOUR_USERNAME/vibecode-webgui/azure/code-server-initramfs.cpio.gz</string>
        <string>--kernel-cmdline</string>
        <string>console=hvc0 quiet</string>
        <string>--device</string>
        <string>virtio-net,nat,mac=52:54:00:12:34:61</string>
        <string>--device</string>
        <string>virtio-rng</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

# Load it
launchctl load ~/Library/LaunchAgents/com.codeserver.vm.plist
```

### Bookmark the URL

Add to bookmarks:
```
http://192.168.64.5:8080
```

Replace with your VM's actual IP.

### Use a Static IP

Instead of DHCP, modify init script for static IP:
```bash
# Edit build-code-server.py line 220
ip addr add 192.168.64.10/24 dev eth0
ip route add default via 192.168.64.1
```

## Features to Try

### 1. Terminal

- Open terminal: Ctrl+\` (backtick)
- Run commands: `ls`, `ps`, `ip addr`
- Multiple terminals: Click + button

### 2. Extensions

Popular extensions to try:
- Python (ms-python.python)
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- GitLens (eamodio.gitlens)
- Live Server (ritwickdey.liveserver)

### 3. Git Integration

- Clone repo: `git clone https://github.com/...`
- View changes: Source Control icon
- Commit: Ctrl+Enter in commit message

### 4. Settings Sync

- Enable: Settings → Settings Sync
- Sign in with GitHub
- Sync across devices

### 5. Themes

- Change theme: Ctrl+K Ctrl+T
- Install new themes: Extensions → Search "theme"

## Next Steps

### Enable Authentication

For production use:

1. Edit `build-code-server.py` line 312
2. Change `auth: none` to `auth: password`
3. Set password: `export PASSWORD="your-password"`
4. Rebuild

### Add Persistent Storage

Add a disk:
```bash
# Create disk image
qemu-img create -f raw workspace.img 10G

# Add to vfkit command
--device virtio-blk,path=/path/to/workspace.img

# Mount in VM
mount /dev/vda /mnt/workspace
```

### Install Language Servers

For better code intelligence:

**Python**:
```bash
# In Code-Server terminal
apk add python3 py3-pip
pip install python-lsp-server
```

**Go**:
```bash
apk add go
go install golang.org/x/tools/gopls@latest
```

**Rust**:
```bash
apk add rust cargo
rustup component add rust-analyzer
```

## Resources

- **Full Documentation**: `CODE-SERVER-README.md`
- **Build Summary**: `CODE-SERVER-BUILD-SUMMARY.md`
- **Build Script**: `build-code-server.py`

## Support

For issues:
1. Check troubleshooting section above
2. Review full documentation
3. Check Code-Server docs: https://coder.com/docs
4. Check vfkit docs: https://github.com/crc-org/vfkit

## Summary

You now have:
- A minimal Code-Server VM (~38 MB)
- Full VS Code experience in browser
- Extension marketplace access
- Built-in terminal
- LSP and MCP ready
- Fast boot times (<10 seconds)
- Low resource usage (~400 MB RAM)

**Happy coding!**
