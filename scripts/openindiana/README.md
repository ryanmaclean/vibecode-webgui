# OpenIndiana Setup Scripts for VibeCode

Automated deployment scripts for running VibeCode on OpenIndiana/illumos with full observability stack.

## Overview

These scripts automate the complete setup process:

1. **VM Creation** - Create OpenIndiana VM (UTM/VirtualBox/QEMU)
2. **LX Zone Setup** - Configure Debian-compatible lx-branded zone
3. **Node.js Installation** - Install Node.js 24 runtime
4. **Database Setup** - PostgreSQL 16 + pgvector
5. **VibeCode Deployment** - Clone and configure application
6. **DTrace Monitoring** - Configure observability probes

## Quick Start

```bash
# 1. Download OpenIndiana ISO
wget https://dlc.openindiana.org/isos/hipster/OI-hipster-gui-20231027.iso

# 2. Create VM
./01-setup-openindiana-vm.sh

# 3. Boot VM and login (default: root / openindiana)

# 4. Inside OpenIndiana VM, run remaining scripts
./02-configure-lx-zone.sh
./03-install-node24.sh
./04-setup-postgres-pgvector.sh
./05-deploy-vibecode.sh
./06-configure-dtrace.sh

# 5. Access VibeCode
# http://<vm-ip>:3000
```

## Prerequisites

**Host System**:
- 8GB+ RAM (16GB recommended)
- 60GB+ free disk space
- Virtualization enabled (VT-x/AMD-V)
- macOS (UTM), Linux (QEMU/KVM), or Windows (VirtualBox)

**Network**:
- Internet connectivity for package downloads
- Available IP address for VM

## Script Details

### 01-setup-openindiana-vm.sh

Creates OpenIndiana VM with optimal settings for VibeCode.

**Platforms**: UTM (macOS), VirtualBox (cross-platform), QEMU (Linux)

**Configuration**:
- 4 vCPUs
- 8GB RAM
- 60GB disk (ZFS)
- Bridged networking

### 02-configure-lx-zone.sh

Sets up lx-branded zone for Debian binary compatibility.

**Actions**:
- Install lx-branded zone package
- Download Debian 11 image
- Create zone configuration
- Configure ZFS datasets
- Set up Crossbow networking

### 03-install-node24.sh

Installs Node.js 24 inside lx zone via NodeSource repository.

**Actions**:
- Add NodeSource repository
- Install Node.js 24 and npm
- Configure npm global packages
- Install build tools

### 04-setup-postgres-pgvector.sh

Installs and configures PostgreSQL 16 with pgvector extension.

**Actions**:
- Install PostgreSQL 16
- Install pgvector extension
- Optimize for ZFS
- Configure authentication
- Create vibecode database

### 05-deploy-vibecode.sh

Clones and deploys VibeCode application.

**Actions**:
- Clone repository
- Install dependencies
- Configure environment
- Build application
- Create SMF manifest
- Start services

### 06-configure-dtrace.sh

Sets up DTrace monitoring and Datadog integration.

**Actions**:
- Deploy DTrace probe scripts
- Configure StatsD bridge
- Set up monitoring dashboards
- Create SMF services

## Directory Structure

```
scripts/openindiana/
├── README.md                           # This file
├── 01-setup-openindiana-vm.sh         # VM creation
├── 02-configure-lx-zone.sh            # LX zone setup
├── 03-install-node24.sh               # Node.js installation
├── 04-setup-postgres-pgvector.sh      # Database setup
├── 05-deploy-vibecode.sh              # VibeCode deployment
├── 06-configure-dtrace.sh             # Monitoring setup
├── dtrace/                            # DTrace probe templates
│   ├── http-latency.d                 # HTTP monitoring
│   ├── database-queries.d             # PostgreSQL monitoring
│   ├── nodejs-gc.d                    # Node.js GC
│   ├── zfs-io.d                       # ZFS I/O
│   └── network-tcp.d                  # Network monitoring
└── configs/                           # Configuration templates
    ├── zone-vibecode.cfg              # Zone configuration
    ├── postgresql.conf.template       # PostgreSQL tuning
    └── vibecode.env.template          # Environment variables
```

## Advanced Usage

### Custom VM Configuration

Edit `01-setup-openindiana-vm.sh` to customize:

```bash
# VM specifications
VM_CPUS=4
VM_MEMORY=8192
VM_DISK_SIZE=60G

# Network
VM_NETWORK_MODE="bridged"  # or "nat"
```

### Multiple Zones

Create multiple isolated zones for multi-tenant deployment:

```bash
# Edit 02-configure-lx-zone.sh
ZONE_NAME="customer1-zone"
ZONE_CPU_CAP=2
ZONE_MEMORY_CAP=4G
```

### Production Deployment

For production, add these steps:

1. **SSL/TLS**: Configure HTTPS with Let's Encrypt
2. **Backups**: Set up automated ZFS snapshots
3. **Monitoring**: Deploy full Datadog integration
4. **HA**: Configure zone failover
5. **Security**: Apply security hardening checklist

## Troubleshooting

### VM Won't Boot

```bash
# Check virtualization support
egrep -c '(vmx|svm)' /proc/cpuinfo  # Should be > 0

# Verify ISO checksum
sha256sum OI-hipster-gui-20231027.iso
```

### Zone Creation Fails

```bash
# Check lx-branded zone support
pkg list brand/lx

# Verify ZFS pool
zpool status

# Check available space
zfs list
```

### Node.js Installation Issues

```bash
# Inside lx zone, check Debian version
cat /etc/debian_version

# Verify network connectivity
ping -c 3 deb.nodesource.com

# Check apt sources
cat /etc/apt/sources.list
```

### PostgreSQL Connection Errors

```bash
# Check PostgreSQL status
systemctl status postgresql

# View logs
tail -f /var/log/postgresql/postgresql-16-main.log

# Test connection
sudo -u postgres psql -c "SELECT version();"
```

### DTrace Permission Errors

```bash
# Verify DTrace privileges
dtrace -l | head

# Add user to dtrace group
usermod -K defaultpriv=basic,dtrace_proc,dtrace_user vibecode
```

## Performance Tuning

### ZFS Optimization

```bash
# For database workloads
zfs set recordsize=8K rpool/zones/vibecode/postgres
zfs set logbias=latency rpool/zones/vibecode/postgres

# For application data
zfs set compression=lz4 rpool/zones/vibecode/app
zfs set atime=off rpool/zones/vibecode/app
```

### PostgreSQL Tuning

```bash
# Edit postgresql.conf based on available memory
shared_buffers = 2GB              # 25% of RAM
effective_cache_size = 6GB        # 75% of RAM
maintenance_work_mem = 512MB
work_mem = 32MB
```

### Node.js Tuning

```bash
# Increase V8 heap size
export NODE_OPTIONS="--max-old-space-size=4096"

# Use more libuv threads
export UV_THREADPOOL_SIZE=16
```

## Security Hardening

### Zone Security

```bash
# Limit zone privileges
zonecfg -z vibecode-zone "set limitpriv=default,!proc_fork"

# Enable security flags
zonecfg -z vibecode-zone "add security-flags; set default=aslr,forbidnullmap,noexecstack; end"
```

### Network Security

```bash
# Enable firewall
svcadm enable ipfilter

# Allow only necessary ports
echo "pass in quick on vibecode0 proto tcp from any to any port = 3000 keep state" >> /etc/ipf/ipf.conf
ipf -Fa -f /etc/ipf/ipf.conf
```

### Application Security

```bash
# Run as non-root
useradd -m vibecode
chown -R vibecode:vibecode /opt/vibecode-webgui

# Use RBAC
usermod -K defaultpriv=basic,net_privaddr vibecode
```

## Backup and Recovery

### Automated Snapshots

```bash
# Hourly snapshots, retain 7 days
cat > /etc/cron.d/zfs-snapshots <<'EOF'
0 * * * * root zfs snapshot rpool/zones/vibecode@hourly-$(date +\%Y\%m\%d-\%H) && zfs list -t snapshot | grep vibecode | head -n -168 | awk '{print $1}' | xargs -n1 zfs destroy
EOF
```

### Database Backups

```bash
# Daily PostgreSQL backup
cat > /etc/cron.d/postgres-backup <<'EOF'
0 2 * * * postgres pg_basebackup -D /backup/postgres/$(date +\%Y\%m\%d) -F tar -z
EOF
```

## Monitoring

### DTrace Dashboards

Access DTrace monitoring:

```bash
# Real-time HTTP latency
./dtrace/http-latency.d

# Database query performance
./dtrace/database-queries.d

# ZFS I/O patterns
./dtrace/zfs-io.d
```

### Datadog Integration

Configure Datadog agent:

```bash
# Follow guide at:
# https://docs.vibecode.com/platforms/datadog-openindiana/
```

## Support

- **Documentation**: https://docs.vibecode.com/platforms/openindiana/
- **GitHub Issues**: https://github.com/your-org/vibecode-webgui/issues
- **Discord**: https://discord.gg/vibecode
- **OpenIndiana Community**: openindiana-discuss@openindiana.org

## License

These scripts are part of VibeCode Platform and are licensed under the same terms.

## Contributing

Contributions welcome! Please submit pull requests with:

- Clear description of changes
- Testing on OpenIndiana Hipster 2023.10+
- Documentation updates
- Example output/screenshots

---

**Next**: Run `01-setup-openindiana-vm.sh` to begin setup.
