# SSH Tunnel Setup for OpenVSCode Access

This document describes how to access OpenVSCode running inside the VM from your host machine using an SSH tunnel.

## Overview

The VM runs OpenVSCode on `127.0.0.1:3000` (localhost only). To access it from the host, we use an SSH tunnel that forwards `localhost:3000` on the host to `127.0.0.1:3000` inside the VM.

## What's Included

The SSH-enabled initramfs includes:
- **Dropbear SSH server** - Lightweight SSH server for embedded systems
- **Root access** - Default password: `password` (change for production!)
- **Auto-start** - SSH server starts automatically on VM boot
- **Port 22** - Standard SSH port

## Quick Start

### 1. Rebuild the Bundle with SSH Support

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
./scripts/rebuild-bundle-with-ssh.sh
```

This will:
- Copy the SSH-enabled initramfs to the app bundle
- Update the kernel if needed
- Prepare the app for running with SSH support

### 2. Launch the Application

```bash
open DatadogDevMenu.app
```

### 3. Find the VM IP Address

Check the VM logs to find the IP address assigned via DHCP:

```bash
./scripts/view-vm-logs.sh
```

Look for a line like:
```
DHCP successful: 192.168.64.3/24
```

### 4. Test SSH Connection

```bash
ssh root@192.168.64.3
# Password: password
```

If successful, you'll see a shell prompt inside the VM.

### 5. Create SSH Tunnel

Use the provided script:

```bash
./scripts/tunnel-to-vm.sh 192.168.64.3
```

Or manually:

```bash
ssh -L 3000:127.0.0.1:3000 root@192.168.64.3
# Password: password
```

Keep this terminal open to maintain the tunnel.

### 6. Access OpenVSCode

Open your browser and navigate to:

```
http://localhost:3000
```

You should now see the OpenVSCode interface!

## Tunnel Script Usage

The `tunnel-to-vm.sh` script automates the SSH tunnel setup with built-in checks:

```bash
# Basic usage (defaults to 192.168.64.3 and port 3000)
./scripts/tunnel-to-vm.sh

# Specify VM IP
./scripts/tunnel-to-vm.sh 192.168.64.5

# Specify custom local port
./scripts/tunnel-to-vm.sh 192.168.64.3 8080
```

The script will:
- Test VM connectivity (ping)
- Verify SSH port is open
- Check if local port is available
- Create the SSH tunnel with keep-alive settings
- Show access URL

## Troubleshooting

### Cannot connect to VM

**Symptoms:** `ping` fails or times out

**Solutions:**
1. Check that the VM is running
2. Check VM logs for network initialization: `./scripts/view-vm-logs.sh`
3. Look for "DHCP successful" message with IP address
4. Verify the VM network interface is up

### SSH connection refused

**Symptoms:** `Connection refused` on port 22

**Solutions:**
1. Wait for VM to fully boot (check logs)
2. Verify dropbear started: Look for "Dropbear SSH server started successfully" in logs
3. Check if SSH port is open: `nc -z -w 2 192.168.64.3 22`

### SSH connection hangs or times out

**Symptoms:** SSH connects but hangs during authentication

**Solutions:**
1. Check VM has enough memory
2. Verify dropbear host keys were generated (check logs for "Generating SSH host keys...")
3. Try increasing timeout: `ssh -o ConnectTimeout=30 root@192.168.64.3`

### Tunnel established but cannot access OpenVSCode

**Symptoms:** SSH tunnel works but `http://localhost:3000` fails

**Solutions:**
1. Verify OpenVSCode is running in the VM:
   ```bash
   ssh root@192.168.64.3 'ps | grep bun'
   ```
2. Check if OpenVSCode is listening on the correct port:
   ```bash
   ssh root@192.168.64.3 'netstat -tln | grep 3000'
   ```
3. Check VM logs for OpenVSCode startup errors
4. Try accessing from within the VM:
   ```bash
   ssh root@192.168.64.3 'wget -O- http://127.0.0.1:3000'
   ```

### Local port already in use

**Symptoms:** `Address already in use` error

**Solutions:**
1. Check what's using the port: `lsof -i :3000`
2. Kill the process or use a different port: `./scripts/tunnel-to-vm.sh 192.168.64.3 3001`
3. Check for existing SSH tunnels: `ps aux | grep ssh`

## Security Notes

**IMPORTANT:** The default configuration uses a simple password (`password`) for root access. This is suitable for local development but **NOT for production use**.

### For Production:

1. **Change the root password** by editing `/tmp/initramfs-check/init`:
   ```bash
   echo "root:your_secure_password" | chpasswd
   ```

2. **Use SSH key authentication** instead of passwords:
   ```bash
   # Generate SSH key on host
   ssh-keygen -t ed25519 -f ~/.ssh/vm_key

   # Add to initramfs /root/.ssh/authorized_keys
   # Then rebuild: ./scripts/rebuild-bundle-with-ssh.sh
   ```

3. **Disable password authentication** in dropbear (add `-s` flag in init script)

4. **Use a firewall** to restrict SSH access

## Technical Details

### Dropbear Configuration

- **Location:** `/bin/dropbear` in initramfs
- **Host Keys:** `/etc/dropbear/dropbear_rsa_host_key` and `dropbear_ecdsa_host_key`
- **Port:** 22 (standard SSH port)
- **Options:**
  - `-R`: Create host keys if missing
  - `-E`: Log to stderr (visible in VM logs)
  - `-p 22`: Listen on port 22

### Dependencies

The following libraries were added to support dropbear:
- `libtomcrypt.so.1` - Cryptographic library
- `libtommath.so.1` - Math library for crypto
- `libz.so.1` - Compression library
- `libcrypt.so.1` - Password hashing (already present)
- `libc.so.6` - Standard C library (already present)

### Initramfs Changes

The SSH-enabled initramfs (`bun-openvscode-with-ssh.cpio.gz`) includes:
1. Dropbear binaries (dropbear, dropbearkey)
2. Required shared libraries
3. Modified init script with SSH server startup
4. SSH directory structure (`/etc/dropbear`, `/root/.ssh`)

## Files

- **Initramfs:** `/Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode-with-ssh.cpio.gz`
- **Rebuild Script:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/scripts/rebuild-bundle-with-ssh.sh`
- **Tunnel Script:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/scripts/tunnel-to-vm.sh`
- **Bundle:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/DatadogDevMenu.app`

## Next Steps

After establishing the tunnel and accessing OpenVSCode:

1. **Test the development environment** - Create a test file, edit code, run terminal commands
2. **Monitor performance** - Check memory usage, CPU, response times
3. **Implement persistent storage** - Add volume mounting for workspace data
4. **Set up authentication** - Add proper user authentication for OpenVSCode
5. **Configure extensions** - Install and configure VS Code extensions
6. **Network optimizations** - Consider using vsock instead of SSH tunnel for better performance

## Alternative: Direct Network Access

If you prefer direct access without SSH tunneling, you can modify the init script to bind OpenVSCode to `0.0.0.0:3000` instead of `127.0.0.1:3000`. This is already configured in the init script with:

```bash
export HOST=0.0.0.0
```

However, this approach has security implications and may require additional firewall rules.

## References

- [Dropbear SSH](https://matt.ucc.asn.au/dropbear/dropbear.html) - Official Dropbear documentation
- [SSH Tunneling Guide](https://www.ssh.com/academy/ssh/tunneling) - SSH port forwarding concepts
- Ubuntu Packages:
  - [dropbear-bin package](https://packages.ubuntu.com/noble/dropbear-bin)
  - [libtomcrypt1 package](https://packages.ubuntu.com/noble/arm64/libtomcrypt1/download)
  - [libtommath1 package](https://launchpad.net/ubuntu/+source/libtommath/1.2.1-2build1)
