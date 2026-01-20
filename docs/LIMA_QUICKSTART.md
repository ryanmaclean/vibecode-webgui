# Lima Quick Start Guide for VibeCode

This guide will help you get started with Lima-managed VMs for VibeCode development.

---

## What is Lima?

Lima (Linux Machines) is a tool for running Linux VMs on macOS with minimal configuration. It provides:

- ✅ YAML-based configuration
- ✅ Cloud image auto-download
- ✅ Declarative provisioning
- ✅ Easy VM lifecycle management
- ✅ Native ARM64 support via Apple Virtualization.framework

---

## Installation

```bash
# Install Lima via Homebrew
brew install lima

# Verify installation
limactl --version
```

---

## VibeCode VMs

VibeCode uses three Lima VMs:

### 1. Valkey VM (Session Storage)
- **Name:** `vibecode-valkey`
- **OS:** Alpine Linux 3.22 ARM64
- **Resources:** 2 CPUs, 1GB RAM, 10GB disk
- **Services:** Valkey 8.1+ (Redis-compatible)
- **Ports:** 6379, 6380

### 2. PostgreSQL VM (Database)
- **Name:** `vibecode-pgvector`
- **OS:** Ubuntu 24.04 ARM64
- **Resources:** 4 CPUs, 8GB RAM, 3 disks (20GB + 100GB + 50GB)
- **Services:** PostgreSQL 16 + pgvector 0.8.0
- **Ports:** 5432, 9187

### 3. Node.js Dev VM (Development)
- **Name:** `vibecode-nodejs-dev`
- **OS:** Ubuntu 24.04 ARM64
- **Resources:** 4 CPUs, 8GB RAM, 50GB disk
- **Services:** Node.js 22 LTS, Rust, build tools
- **Ports:** 3000, 5173, 8080, 9229

---

## Quick Start

### Using the Lima Manager Script (Recommended)

The easiest way to manage VibeCode VMs is with the provided script:

```bash
# Show VM status
./scripts/lima-manager.sh status

# Start all VMs
./scripts/lima-manager.sh start

# Start specific VM
./scripts/lima-manager.sh start valkey
./scripts/lima-manager.sh start postgres
./scripts/lima-manager.sh start nodejs

# Stop all VMs
./scripts/lima-manager.sh stop

# Open shell in VM
./scripts/lima-manager.sh shell valkey
./scripts/lima-manager.sh shell postgres
./scripts/lima-manager.sh shell nodejs

# Run connectivity tests
./scripts/lima-manager.sh test

# Validate configurations
./scripts/lima-manager.sh validate

# Show help
./scripts/lima-manager.sh help
```

### Using limactl Directly

If you prefer using `limactl` commands directly:

```bash
# Start Valkey VM
limactl start --name=vibecode-valkey config/lima/valkey-vm.yaml

# Start PostgreSQL VM
limactl start --name=vibecode-pgvector config/lima/postgresql-pgvector-vm.yaml

# Start Node.js Dev VM
limactl start --name=vibecode-nodejs-dev config/lima/nodejs-dev-vm.yaml

# List all VMs
limactl list

# Open shell in VM
limactl shell vibecode-valkey

# Stop VM
limactl stop vibecode-valkey

# Delete VM
limactl delete vibecode-valkey
```

---

## Common Tasks

### Access Valkey

**From host:**
```bash
# Test connection
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping

# Set a key
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 SET mykey "Hello"

# Get a key
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 GET mykey
```

**From VM shell:**
```bash
# Open shell
limactl shell vibecode-valkey

# Connect to Valkey
sudo valkey-cli -a VibeCodeChangeMe2025 ping

# View logs
sudo tail -f /var/log/valkey/valkey.log
```

### Access PostgreSQL

**From host:**
```bash
# Connect to database
psql -h localhost -p 5432 -U vibecode -d vibecode

# Run query
psql -h localhost -p 5432 -U vibecode -d vibecode -c "SELECT version();"

# Check pgvector
psql -h localhost -p 5432 -U vibecode -d vibecode -c "\dx"
```

**From VM shell:**
```bash
# Open shell
limactl shell vibecode-pgvector

# Connect as postgres user
sudo -u postgres psql

# View logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Check disk mounts
df -h
```

### Use Node.js Dev Environment

**From VM shell:**
```bash
# Open shell
limactl shell vibecode-nodejs-dev

# Navigate to workspace
cd /workspace/vibecode-webgui

# Install dependencies
npm install

# Run dev server
npm run dev

# Check Node.js version
node --version  # Should be v22.x

# Check Rust
rustc --version
```

**From host:**
- Workspace is mounted at `/workspace/vibecode-webgui` in VM
- Edit files on host, run commands in VM
- Dev servers accessible on host (ports 3000, 5173, 8080)

---

## VM Lifecycle

### Starting VMs

```bash
# Start all
./scripts/lima-manager.sh start

# Or individually
limactl start vibecode-valkey
limactl start vibecode-pgvector
limactl start vibecode-nodejs-dev
```

**First start:**
- Downloads cloud image (cached for future use)
- Creates VM disk
- Runs provisioning scripts
- Takes ~60-120 seconds

**Subsequent starts:**
- Uses cached image and existing disk
- Takes ~30-60 seconds

### Stopping VMs

```bash
# Stop all
./scripts/lima-manager.sh stop

# Or individually
limactl stop vibecode-valkey
```

**Graceful shutdown:**
- Services stopped cleanly
- Disk changes saved
- VM can be restarted later

### Deleting VMs

```bash
# Delete with confirmation
./scripts/lima-manager.sh delete valkey

# Force delete (be careful!)
limactl delete vibecode-valkey -f
```

**Warning:** This deletes all VM data permanently!

---

## Configuration Files

All Lima configurations are in `config/lima/`:

```
config/lima/
├── valkey-vm.yaml              # Valkey VM config
├── postgresql-pgvector-vm.yaml # PostgreSQL VM config
└── nodejs-dev-vm.yaml          # Node.js VM config
```

### Editing Configurations

1. Stop the VM:
   ```bash
   limactl stop vibecode-valkey
   ```

2. Edit the config file:
   ```bash
   vim config/lima/valkey-vm.yaml
   ```

3. Validate the config:
   ```bash
   limactl validate config/lima/valkey-vm.yaml
   ```

4. Restart the VM:
   ```bash
   limactl start vibecode-valkey
   ```

---

## Troubleshooting

### VM won't start

**Check logs:**
```bash
# View boot log
tail -f ~/.lima/vibecode-valkey/serial*.log

# View host agent log
tail -f ~/.lima/vibecode-valkey/ha.stderr.log
```

**Common issues:**
- Port conflict: Check if ports (6379, 5432, etc.) are already in use
- Insufficient resources: Ensure enough RAM/CPU available
- Invalid config: Run `limactl validate config/lima/vm.yaml`

### Service not running

**Open shell and check:**
```bash
# For Valkey
limactl shell vibecode-valkey
sudo rc-status  # Check service status
sudo rc-service valkey status
sudo tail -f /var/log/valkey/valkey.log

# For PostgreSQL
limactl shell vibecode-pgvector
sudo systemctl status postgresql
sudo -u postgres pg_isready
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Port forwarding not working

**Check if VM is running:**
```bash
limactl list
```

**Check if service is listening:**
```bash
limactl shell vibecode-valkey
sudo netstat -tlnp | grep 6379
```

**Check host port:**
```bash
lsof -i :6379
```

### VM running slowly

**Check resource allocation:**
```bash
limactl list  # Shows CPU/Memory allocation
```

**Increase resources:**
Edit config file and adjust `cpus:` and `memory:` values, then restart VM.

### Disk full

**Check disk usage:**
```bash
limactl shell vibecode-valkey
df -h
```

**For PostgreSQL (multiple disks):**
```bash
limactl shell vibecode-pgvector
df -h
# Check /mnt/pgdata and /mnt/backup
```

**Note:** Disk size can only be increased, not decreased. To resize:
1. Stop VM
2. Edit config file (increase `disk:` value)
3. Start VM
4. Resize filesystem from within VM

---

## Performance Tips

### 1. Use VZ Driver (Default)

Lima defaults to `vmType: "vz"` on macOS 13+ which uses Apple's Virtualization.framework for best performance.

### 2. Allocate Sufficient Resources

- **Valkey:** 2 CPUs, 1GB RAM (sufficient)
- **PostgreSQL:** 4 CPUs, 8GB RAM (for vector workloads)
- **Node.js:** 4 CPUs, 8GB RAM (for builds with native modules)

### 3. Use Cached Images

Lima caches downloaded images. First start is slow, subsequent starts are fast.

### 4. Mount Only What You Need

Only mount directories you actually need. The Node.js VM mounts:
- `~/vibecode-webgui` → `/workspace/vibecode-webgui`
- `~/.npm` → `/home/lima/.npm`

Unnecessary mounts add overhead.

### 5. Use virtiofs for Mounts (Default)

Lima uses `virtiofs` by default on macOS for fast filesystem sharing.

---

## Advanced Usage

### Snapshots

```bash
# Create snapshot
limactl snapshot create vibecode-valkey my-snapshot

# List snapshots
limactl snapshot list vibecode-valkey

# Restore snapshot
limactl snapshot restore vibecode-valkey my-snapshot

# Delete snapshot
limactl snapshot delete vibecode-valkey my-snapshot
```

### Copy Files Between Host and VM

```bash
# Copy from host to VM
limactl copy file.txt vibecode-valkey:/tmp/

# Copy from VM to host
limactl copy vibecode-valkey:/tmp/file.txt ./
```

### Run Commands in VM

```bash
# Run single command
limactl shell vibecode-valkey sudo valkey-cli -a VibeCodeChangeMe2025 ping

# Run script
limactl shell vibecode-valkey < my-script.sh
```

### Multiple VM Profiles

You can run multiple instances of the same VM config:

```bash
limactl start --name=valkey-dev config/lima/valkey-vm.yaml
limactl start --name=valkey-test config/lima/valkey-vm.yaml
```

---

## Environment Variables

Lima supports environment variables in configs:

```yaml
env:
  NODE_OPTIONS: "--max-old-space-size=6144"
  CARGO_BUILD_JOBS: "4"
```

Access in VM:
```bash
limactl shell vibecode-nodejs-dev
echo $NODE_OPTIONS
```

---

## Health Checks

Lima supports readiness probes:

```yaml
probes:
  - mode: readiness
    description: "valkey"
    script: |
      #!/bin/bash
      valkey-cli -a PASSWORD ping | grep -q PONG
```

VM won't be marked "Ready" until probe succeeds.

---

## Networking

### Default Network Mode

VMs use NAT networking with port forwarding. VM gets IP like `192.168.5.15`.

### Inter-VM Communication

VMs can talk to each other via Lima's internal network:

```bash
# From Node.js VM
limactl shell vibecode-nodejs-dev
curl http://192.168.5.15:6379  # Access Valkey VM
```

Find VM IP:
```bash
limactl shell vibecode-valkey
ip addr show lima0
```

---

## Comparison with vfkit

| Feature | vfkit | Lima |
|---------|-------|------|
| Config files | ❌ None | ✅ YAML |
| Setup complexity | ❌ High | ✅ Low |
| VM management | ❌ Manual | ✅ limactl CLI |
| Cloud images | ❌ Manual | ✅ Auto-download |
| Provisioning | ❌ Manual | ✅ Declarative |
| Multiple VMs | ❌ Hard | ✅ Easy |

**Recommendation:** Use Lima for all VibeCode VMs.

---

## Resources

- **Lima Documentation:** https://lima-vm.io/docs/
- **Lima GitHub:** https://github.com/lima-vm/lima
- **Example Templates:** `/opt/homebrew/share/lima/templates/`
- **VibeCode Configs:** `config/lima/`
- **Comparison Report:** `docs/LIMA_VS_VFKIT_COMPARISON.md`

---

## Getting Help

### Check Logs
```bash
# VM boot log
tail -f ~/.lima/vibecode-valkey/serial*.log

# Host agent log
tail -f ~/.lima/vibecode-valkey/ha.stderr.log

# Service logs (from VM shell)
limactl shell vibecode-valkey
sudo tail -f /var/log/valkey/valkey.log
```

### Run Tests
```bash
./scripts/lima-manager.sh test
```

### Validate Configs
```bash
./scripts/lima-manager.sh validate
```

### Debug Mode
```bash
limactl --debug start vibecode-valkey
```

---

## Summary

Lima provides a clean, declarative way to manage VMs for VibeCode:

✅ **Easy setup:** One YAML file per VM
✅ **Simple commands:** `limactl start/stop/shell`
✅ **Fast:** Native ARM64 with VZ driver
✅ **Reliable:** Cloud images with digest verification
✅ **Maintainable:** Version-controlled configs

**Get started now:**
```bash
./scripts/lima-manager.sh start
./scripts/lima-manager.sh test
./scripts/lima-manager.sh shell valkey
```

Happy coding!
