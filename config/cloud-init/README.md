# Cloud-Init Configurations for VibeCode VMs

This directory contains cloud-init configurations for bootstrapping Alpine Linux VMs with various services.

## Overview

Cloud-init is a standard method for configuring VMs on first boot. These configurations install and configure services automatically when VMs are created from base Alpine Linux images.

## Available Configurations

### 1. PostgreSQL VM (`postgresql-user-data.yaml`)

Installs and configures PostgreSQL database server.

**Services Installed:**
- PostgreSQL 16+ with pgvector extension support
- PostgreSQL client tools
- SSH server

**Configuration:**
- Listens on `0.0.0.0:5432` (accessible from host)
- Default user: `postgres` with password: `postgres`
- Creates `vibecode` database
- Auto-starts on boot via OpenRC

**Testing:**
```bash
psql -h <vm-ip> -U postgres -d vibecode
# Password: postgres
```

### 2. Valkey VM (`valkey-user-data.yaml`)

Installs and configures Valkey (Redis-compatible key-value store).

**Services Installed:**
- Redis/Valkey server
- Redis CLI tools
- SSH server

**Configuration:**
- Listens on `0.0.0.0:6379` (accessible from host)
- Protected mode disabled (for development)
- Auto-starts on boot via OpenRC

**Testing:**
```bash
redis-cli -h <vm-ip> PING
# Expected: PONG
```

### 3. Node.js VM (`nodejs-user-data.yaml`)

Installs Node.js runtime and creates a simple HTTP server.

**Services Installed:**
- Node.js runtime
- npm package manager
- Git
- SSH server

**Configuration:**
- HTTP server on port `3000`
- Test server at `/opt/vibecode/server.js`
- Auto-starts on boot via local service

**Testing:**
```bash
curl http://<vm-ip>:3000/
# Expected: VibeCode Node.js VM - Ready
```

### 4. Code-Server VM (`codeserver-user-data.yaml`)

Installs VS Code Server (code-server) for browser-based development.

**Services Installed:**
- Node.js runtime
- code-server (VS Code in browser)
- Python 3
- Build tools (gcc, make, etc.)
- Git
- SSH server

**Configuration:**
- Listens on `0.0.0.0:8080` (accessible from host)
- Password: `vibecode`
- Auto-starts on boot via local service (if installation succeeds)
- Graceful fallback if code-server installation fails

**Testing:**
```bash
curl http://<vm-ip>:8080/
# Or open in browser: http://<vm-ip>:8080
# Password: vibecode
```

### 5. SSH Configuration (`ssh-user-data.yaml`)

Base SSH configuration for VMs (used as a building block).

**Configuration:**
- SSH server enabled
- Key-based authentication
- User: `vibecode` with sudo privileges

## Usage

### Building VMs with Cloud-Init

Use the provided script to build VMs with services pre-installed:

```bash
./scripts/rebuild-all-vms-with-services.sh
```

This script:
1. Downloads Alpine Linux cloud image
2. Converts to RAW format for Virtualization framework
3. Injects SSH key into cloud-init config
4. Creates cloud-init ISO with service configuration
5. Creates EFI NVRAM for UEFI boot
6. Outputs VM images to `dist/vm-images/`

### Manual VM Creation

To create a single VM manually:

```bash
# 1. Prepare cloud-init configuration
SSH_PUBKEY=$(cat ~/.ssh/vibecode/id_ed25519.pub)
sed "s|__SSH_PUBKEY__|$SSH_PUBKEY|g" config/cloud-init/nodejs-user-data.yaml > /tmp/user-data.yaml

# 2. Create cloud-init ISO
mkdir -p /tmp/cloud-init-seed
cp /tmp/user-data.yaml /tmp/cloud-init-seed/user-data

cat > /tmp/cloud-init-seed/meta-data << EOF
instance-id: nodejs-001
local-hostname: vibecode-nodejs
EOF

# 3. Build ISO (choose one method)
# macOS:
hdiutil makehybrid -o /tmp/seed.iso /tmp/cloud-init-seed -iso -joliet

# Linux:
mkisofs -output /tmp/seed.iso -volid cidata -joliet -rock /tmp/cloud-init-seed

# 4. Attach the ISO to VM during first boot
# The ISO will be automatically processed by cloud-init
```

## Validation

Validate cloud-init configurations before deploying:

```bash
./scripts/validate-cloud-init-configs.sh
```

This checks:
- ✓ YAML syntax validity
- ✓ Required fields (hostname, packages, users, runcmd)
- ✓ Alpine Linux compatibility (openssh, shell paths, OpenRC)
- ✓ Service-specific requirements (packages, auto-start)

## Alpine Linux Specifics

These configurations are designed for Alpine Linux and use:

### Package Management
- `apk` package manager (packages listed in `packages:` section)
- Packages installed automatically on first boot

### Service Management (OpenRC)
- `rc-update add <service> default` - Enable service at boot
- `rc-service <service> start` - Start service immediately

### Shell and Users
- Default shell: `/bin/ash` (not bash)
- User commands use: `su -s /bin/sh <user> -c "command"`
- The `-s /bin/sh` is required for Alpine compatibility

### Auto-Start Scripts
For services without OpenRC init scripts (Node.js, code-server):
- Scripts placed in `/etc/local.d/*.start`
- Must be executable (`chmod +x`)
- Enabled via `rc-update add local default`
- Run via `local` service at boot

## SSH Access

All VMs include a `vibecode` user with:
- Sudo privileges (passwordless)
- SSH key authentication
- Shell: `/bin/ash`

Replace `__SSH_PUBKEY__` placeholder with your public key:
```bash
cat ~/.ssh/vibecode/id_ed25519.pub
```

## Logs and Debugging

Cloud-init logs are available in the VM:
- `/var/log/vibecode-setup.log` - Service installation log
- `/var/log/cloud-init.log` - Cloud-init execution log
- `/var/log/cloud-init-output.log` - Command output

Check logs via SSH:
```bash
ssh vibecode@<vm-ip>
cat /var/log/vibecode-setup.log
```

## Testing Services

Use the provided health check script:

```bash
./scripts/test-service-health.sh <vm-ip>
```

This tests all services:
1. PostgreSQL on port 5432
2. Valkey on port 6379
3. Node.js on port 3000
4. Code-server on port 8080

## Troubleshooting

### Service Not Starting

1. **Check if service is enabled:**
   ```bash
   ssh vibecode@<vm-ip> "rc-status"
   ```

2. **Check service logs:**
   ```bash
   ssh vibecode@<vm-ip> "cat /var/log/vibecode-setup.log"
   ```

3. **Manually start service:**
   ```bash
   ssh vibecode@<vm-ip> "sudo rc-service <service> start"
   ```

### Cloud-Init Not Running

1. **Verify ISO is attached to VM**
   - Check VMManager.swift ensures cloud-init ISO is attached
   - ISO must be named `<vm-id>-seed.iso`

2. **Check cloud-init status:**
   ```bash
   ssh vibecode@<vm-ip> "cloud-init status"
   ```

3. **Re-run cloud-init manually:**
   ```bash
   ssh vibecode@<vm-ip> "sudo cloud-init clean && sudo cloud-init init"
   ```

### Package Installation Fails

Check Alpine version and package availability:
```bash
ssh vibecode@<vm-ip> "cat /etc/alpine-release"
ssh vibecode@<vm-ip> "apk search <package-name>"
```

## Architecture

### VM Lifecycle

```
1. VM Created with base Alpine image
2. Cloud-init ISO attached as secondary disk
3. VM boots, cloud-init detects config
4. Cloud-init executes:
   a. Create users
   b. Install packages (via apk)
   c. Write files
   d. Run commands (runcmd)
5. Services start automatically
6. VM ready for use
```

### File Structure

```
config/cloud-init/
├── README.md                      # This file
├── postgresql-user-data.yaml      # PostgreSQL config
├── valkey-user-data.yaml          # Valkey/Redis config
├── nodejs-user-data.yaml          # Node.js config
├── codeserver-user-data.yaml      # Code-server config
└── ssh-user-data.yaml             # Base SSH config
```

## Best Practices

### DevOps 2025 Alignment

These configurations follow modern DevOps practices:

1. **Infrastructure as Code**: All VM configuration is versioned in YAML
2. **Immutable Infrastructure**: VMs are created fresh, not modified
3. **Automation**: No manual installation steps required
4. **Idempotency**: Can be re-run safely
5. **Validation**: Automated checks before deployment
6. **Observability**: Comprehensive logging
7. **Security**: SSH keys, not passwords; services on private networks

### Writing Custom Configurations

When creating new cloud-init configs:

1. **Start with a template**: Copy an existing config
2. **Validate YAML**: Run `./scripts/validate-cloud-init-configs.sh`
3. **Test in isolation**: Create a single test VM first
4. **Check logs**: Always verify `/var/log/vibecode-setup.log`
5. **Use Alpine syntax**: Remember `rc-update`, `/bin/ash`, `apk`
6. **Enable auto-start**: Add `rc-update add <service> default`
7. **Document**: Add testing instructions

## References

- [Cloud-Init Documentation](https://cloudinit.readthedocs.io/)
- [Alpine Linux Wiki](https://wiki.alpinelinux.org/)
- [OpenRC Service Management](https://wiki.gentoo.org/wiki/OpenRC)
- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)

## Related Files

- `scripts/rebuild-all-vms-with-services.sh` - Build script
- `scripts/validate-cloud-init-configs.sh` - Validation script
- `scripts/test-service-health.sh` - Health check script
- `VibeCodeSwift/Sources/ViewModels/VMManager.swift` - VM management
- `.github/ISSUE_TEMPLATE/02-install-services.md` - Requirements doc

## Support

For issues or questions:
1. Validate configuration: `./scripts/validate-cloud-init-configs.sh`
2. Check VM logs: `cat /var/log/vibecode-setup.log`
3. Test services: `./scripts/test-service-health.sh <vm-ip>`
4. Review troubleshooting section above
