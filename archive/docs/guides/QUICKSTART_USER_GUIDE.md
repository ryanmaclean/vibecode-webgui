# VibeCode Quick Start Guide

## What is VibeCode?

VibeCode provides a complete local development environment using native macOS virtualization. Get PostgreSQL, Valkey (Redis), Node.js, and OpenVSCode running in isolated virtual machines with one click.

## Requirements

- macOS 15 (Sequoia) or later
- Apple Silicon (M1/M2/M3/M4) or Intel Mac
- 16GB RAM minimum (32GB recommended)
- 50GB free disk space

## Installation

1. Download VibeCode.app
2. Move to Applications folder
3. Launch VibeCode
4. Grant virtualization permissions if prompted

## First Launch

When you first launch VibeCode:

1. The app will discover 6 pre-configured VMs
2. The code server VM will auto-start (takes ~30 seconds)
3. Other VMs can be started manually

## Using the VMs

### Start a VM

1. Click a VM in the sidebar (e.g., "Postgresql")
2. Click the "Start VM" button
3. Wait for status to show "Running" (15-30 seconds)

### Available Services

| Service | VM Name | Purpose |
|---------|---------|---------|
| PostgreSQL | Postgresql | Database server |
| Valkey | Valkey | Redis-compatible cache |
| Node.js | Nodejs | JavaScript runtime |
| OpenVSCode | Nodejs-Codeserver | Web-based IDE |
| PostgreSQL+Vectors | Pgvector | Database with vector support |
| IDE | Ide | Development environment |

### Connecting to Services

Once a VM is running, connect using the VM's IP address:

```bash
# Find VM IP
./scripts/find-vm-ips.sh

# Connect to PostgreSQL
psql -h 192.168.64.X -p 5432 -U postgres

# Connect to Valkey
redis-cli -h 192.168.64.X -p 6379

# Access OpenVSCode
open http://192.168.64.X:8080
```

## SSH Access

If VMs were built with SSH support:

```bash
# Find VM IPs
./scripts/find-vm-ips.sh

# SSH into a VM
ssh -F ~/.ssh/vibecode/config vibecode-postgresql

# Or directly
ssh vibecode@192.168.64.X
```

## Troubleshooting

### VMs Won't Start

**Error**: "The process doesn't have the 'com.apple.security.virtualization' entitlement"

**Solution**: App needs proper signing:
```bash
cd /path/to/vibecode-webgui
./scripts/launch-vibecode.sh
```

### Can't Find VMs

**Check**: Are VM images present?
```bash
ls -lh dist/vm-images/
# Should see 6 .img files and 6 -efi.nvram files
```

### Network Issues

**Find VM IPs**:
```bash
./scripts/find-vm-ips.sh
```

**Test connectivity**:
```bash
./scripts/test-service-health.sh 192.168.64.X
```

### Performance Issues

**Check**: Running on macOS 26 Tahoe?
- Tahoe uses ASIF disk format (2-3x faster)
- Older macOS uses RAW format
- VibeCode auto-detects and optimizes

## Advanced Usage

### View Logs

```bash
# Application logs
tail -f ~/vibecode-webgui/logs/vibecode.log

# VM console logs (if configured)
tail -f ~/vibecode-webgui/logs/Postgresql-console.log
```

### Monitor with Datadog

If Datadog is configured, view metrics at:
- Metrics: https://app.datadoghq.com/metric/summary?filter=vibecode
- Logs: https://app.datadoghq.com/logs?query=service:vibecode
- Dashboard: (import from config/datadog/vibecode-dashboard.json)

### Run Tests

```bash
# Full test suite
./scripts/vibecode-menu.sh
# Select option 9 (Run full test suite)

# Individual tests
./scripts/test-gui.sh
./scripts/functional-tests.sh
./scripts/service-tests.sh
```

## Best Practices

### Resource Management

- Start only the VMs you need
- Stop VMs when done (saves RAM)
- PostgreSQL and Valkey can run continuously
- IDE VMs are heavier (start on demand)

### Performance Tips

1. **Allocate enough RAM**: 4GB per VM recommended
2. **Use SSD storage**: VMs on external drives will be slower
3. **Upgrade to Tahoe**: Get ASIF format for 2-3x performance
4. **Close other apps**: Give VMs dedicated resources

### Security

- VMs are isolated from each other
- NAT network provides security
- No incoming connections from internet
- SSH keys recommended over passwords

## Known Limitations

- Requires macOS running on physical hardware (no nested virtualization)
- VMs use NAT network (direct IP access, not localhost)
- First boot may be slower (EFI initialization)
- Console output limited (use SSH for full access)

## Getting Help

### Check Logs
```bash
tail -100 ~/vibecode-webgui/logs/vibecode.log | grep ERROR
```

### Run Diagnostics
```bash
./scripts/complete-feature-validation.sh
```

### Documentation
- Architecture: docs/OBSERVABILITY_STRATEGY.md
- Networking: docs/NESTED_VIRTUALIZATION.md
- Datadog: docs/ASIF_DISK_FORMAT.md

## Updates and Maintenance

### Update VMs

```bash
# Rebuild VMs with latest configs
./scripts/build-vz-vms-parallel.sh
```

### Check for Updates

```bash
cd /path/to/vibecode-webgui
git pull origin main
./scripts/launch-vibecode.sh
```

## FAQ

**Q: Why can't I access services on localhost?**  
A: VMs use NAT networking. Connect to VM IPs directly (192.168.64.x).

**Q: How do I find VM IP addresses?**  
A: Run `./scripts/find-vm-ips.sh`

**Q: Can I run this inside another VM?**  
A: No. Requires bare metal macOS (nested virtualization not supported).

**Q: Will this work on Intel Macs?**  
A: Yes, but performance is better on Apple Silicon.

**Q: How much disk space do VMs use?**  
A: ~10GB per VM (sparse files, grow as needed).

**Q: Can I add more VMs?**  
A: Yes, follow the VM build scripts and add to `dist/vm-images/`.

## Next Steps

1. Start the VMs you need
2. Find their IP addresses
3. Connect to services
4. Build your applications

Enjoy your local development environment!

