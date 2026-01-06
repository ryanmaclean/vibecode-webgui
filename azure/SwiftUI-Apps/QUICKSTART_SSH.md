# Quick Start: SSH Tunnel to OpenVSCode

This guide gets you up and running with SSH access to OpenVSCode in under 5 minutes.

## Step 1: Build App with SSH Support

Choose one of these methods:

### Method A: Use existing build script (recommended for new builds)

Edit the build script to use SSH-enabled initramfs:

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

# Edit build script to use bun-openvscode-with-ssh.cpio.gz
# Find this line in build-apps.sh or build-all-refactored.sh:
# cp "$AZURE_DIR/bun-openvscode-with-modules.cpio.gz" "$RESOURCES_DIR/initrd"
#
# Replace with:
# cp "$AZURE_DIR/bun-openvscode-with-ssh.cpio.gz" "$RESOURCES_DIR/initrd"

# Then build normally
./build-apps.sh
```

### Method B: Update existing bundle

If you already have a built app:

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps

# Copy SSH initramfs to existing bundle
cp /Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-ssh.cpio.gz \
   DatadogDevMenu.app/Contents/Resources/initrd
```

## Step 2: Launch the App

```bash
open DatadogDevMenu.app
```

## Step 3: Get the VM IP

Watch the logs for the DHCP message:

```bash
./scripts/view-vm-logs.sh | grep "DHCP successful"
```

You'll see something like:
```
DHCP successful: 192.168.64.3/24
```

## Step 4: Test SSH (Optional)

```bash
ssh root@192.168.64.3
# Password: password
```

Type `exit` to disconnect.

## Step 5: Create Tunnel

```bash
./scripts/tunnel-to-vm.sh 192.168.64.3
# Password: password
```

Keep this terminal open!

## Step 6: Access OpenVSCode

Open in your browser:
```
http://localhost:3000
```

Done!

## Troubleshooting

### VM IP not shown in logs?

Wait 30 seconds and check again - VM boot takes time.

### SSH connection refused?

Wait for "Dropbear SSH server started successfully" message in logs:
```bash
./scripts/view-vm-logs.sh | grep -i dropbear
```

### Can't reach http://localhost:3000?

1. Verify tunnel is active (keep SSH terminal open)
2. Check OpenVSCode started:
   ```bash
   ./scripts/view-vm-logs.sh | grep "Starting OpenVSCode"
   ```

### Need help?

See detailed docs: [SSH_TUNNEL_SETUP.md](./SSH_TUNNEL_SETUP.md)

## One-Liner (After Initial Setup)

```bash
# Start VM
open DatadogDevMenu.app

# Wait 30s, then in another terminal:
./scripts/tunnel-to-vm.sh 192.168.64.3

# Open browser to http://localhost:3000
```
