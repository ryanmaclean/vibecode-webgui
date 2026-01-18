# Start 4 VMs with Lima (Easy Mode!)

## Why Lima?

Lima uses vfkit under the hood but handles all the complexity:
- ✅ Downloads Alpine cloud images automatically
- ✅ Sets up cloud-init provisioning
- ✅ Handles port forwarding
- ✅ Manages VM lifecycle
- ✅ **Takes 5 minutes instead of 3 hours**

## Prerequisites

```bash
# Install Lima if not already installed
brew install lima
```

## Start All 4 VMs

### 1. Start Valkey VM (Port 6379)

```bash
limactl start --name=vibecode-valkey config/lima/valkey-vm.yaml
```

**What it does:**
- Downloads Alpine 3.22 cloud image (~60MB)
- Provisions Valkey 7.2.6+
- Exposes port 6379 to host
- Auto-starts on boot

### 2. Start PostgreSQL VM (Port 5432)

```bash
limactl start --name=vibecode-postgresql config/lima/postgresql-pgvector-vm.yaml
```

**What it does:**
- Downloads Alpine 3.22 cloud image
- Installs PostgreSQL 16
- Installs pgvector extension
- Exposes port 5432
- Sets up data persistence

### 3. Start Node.js Dev VM (Port 3000)

```bash
limactl start --name=vibecode-nodejs config/lima/nodejs-dev-vm.yaml
```

**What it does:**
- Downloads Alpine 3.22 cloud image
- Installs Node.js 20/22/24
- Installs npm, yarn, pnpm
- Sets up development environment

### 4. Verify All VMs Running

```bash
limactl list
```

Expected output:
```
NAME                  STATUS     SSH                ARCH      CPUS    MEMORY    DISK
vibecode-valkey       Running    127.0.0.1:60022    aarch64   2       1GiB      10GiB
vibecode-postgresql   Running    127.0.0.1:60023    aarch64   4       8GiB      100GiB
vibecode-nodejs       Running    127.0.0.1:60024    aarch64   4       4GiB      20GiB
```

## Test Services

### Test Valkey

```bash
# From host
redis-cli -h localhost -p 6379 ping
# Should return: PONG

# Or SSH into VM
limactl shell vibecode-valkey
valkey-cli ping
```

### Test PostgreSQL

```bash
# From host
psql -h localhost -p 5432 -U postgres -c "SELECT version();"

# Or SSH into VM
limactl shell vibecode-postgresql
psql -U postgres -c "CREATE EXTENSION vector;"
```

### Test Node.js

```bash
# SSH into VM
limactl shell vibecode-nodejs
node --version
npm --version
```

## VM Management

### Stop VMs

```bash
limactl stop vibecode-valkey
limactl stop vibecode-postgresql
limactl stop vibecode-nodejs
```

### Stop All VMs

```bash
limactl stop --all
```

### Delete VMs

```bash
limactl delete vibecode-valkey
limactl delete vibecode-postgresql
limactl delete vibecode-nodejs
```

### View VM Logs

```bash
limactl shell vibecode-valkey cat /var/log/valkey/valkey.log
```

### SSH into VM

```bash
limactl shell vibecode-valkey
```

## Why This is Better Than Raw vfkit

| Feature | Lima | Raw vfkit |
|---------|------|-----------|
| **Setup Time** | 5 minutes | 3 hours |
| **Image Download** | Automatic | Manual |
| **Cloud-init** | Built-in | Manual setup |
| **Port Forwarding** | Automatic | Manual config |
| **VM Management** | `limactl` CLI | Shell scripts |
| **Persistence** | Built-in | Manual setup |
| **Networking** | Just works | NAT config needed |

## File Locations

After starting, VMs are stored in:
```
~/.lima/vibecode-valkey/
~/.lima/vibecode-postgresql/
~/.lima/vibecode-nodejs/
```

Each contains:
- Disk image
- Lima configuration
- SSH keys
- Logs

## Performance

Lima uses the same Apple Virtualization Framework as vfkit (via `vmType: "vz"`), so performance is identical.

## Next Steps

After VMs are running:
1. Update `.env.local` with connection strings
2. Test application connectivity
3. Run database migrations
4. Profit! 🎉

